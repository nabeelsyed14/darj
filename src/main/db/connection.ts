import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

let db: Database | null = null

export async function initDb(): Promise<Database> {
  if (db) return db

  const dbDir = join(app.getPath('appData'), 'Darj')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'data.db')
  const appDir = dirname(dirname(__dirname))
  const wasmPath = join(appDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    const instance = new SQL.Database(buffer)
    migrateDb(instance)
    db = instance
  } else {
    const instance = new SQL.Database()
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try { instance.run(stmt + ';') } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) throw e
      }
    }
    db = instance
    saveDb()
  }

  return db!
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

export function saveDb(): void {
  if (!db) return
  const dbDir = join(app.getPath('appData'), 'Darj')
  const dbPath = join(dbDir, 'data.db')
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}

function migrateDb(database: Database): void {
  try {
    // Check if students table has restrictive CHECK constraint
    const schema = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'")
    const createSql = schema[0]?.values[0]?.[0] as string || ''
    // If constraint doesn't include 'on_leave', rebuild table
    if (createSql && !createSql.includes('on_leave')) {
      database.run('CREATE TABLE IF NOT EXISTS students_new (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL, section_id INTEGER NOT NULL, student_uid TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT \'active\', enrollment_date DATE, photo TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id), FOREIGN KEY (section_id) REFERENCES sections(id))')
      database.run('INSERT INTO students_new (id, school_id, section_id, student_uid, status, enrollment_date, photo, created_at) SELECT id, school_id, section_id, student_uid, CASE WHEN status IN (\'active\',\'withdrawn\',\'promoted\',\'failed\',\'on_leave\',\'transferred\',\'passed_out\') THEN status ELSE \'active\' END, enrollment_date, photo, created_at FROM students')
      database.run('DROP TABLE students')
      database.run('ALTER TABLE students_new RENAME TO students')
      database.run('CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id)')
      database.run('CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)')
    }
  } catch {}
}

export function closeDb(): void {
  saveDb()
  db = null
}

export function queryOne(sql: string, params: any[] = []): Record<string, any> | null {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

export function queryAll(sql: string, params: any[] = []): Record<string, any>[] {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: Record<string, any>[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export function queryRun(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const database = getDb()
  database.run(sql, params)
  const lastId = database.exec('SELECT last_insert_rowid() as id')
  const changes = database.exec('SELECT changes() as c')
  return {
    lastInsertRowid: lastId[0]?.values[0]?.[0] as number ?? 0,
    changes: changes[0]?.values[0]?.[0] as number ?? 0
  }
}

export function queryExec(sql: string): void {
  const database = getDb()
  database.run(sql)
}
