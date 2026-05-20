import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

let db: Database | null = null
let autoSaveInterval: ReturnType<typeof setInterval> | null = null

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
    // Flush migration changes to disk immediately
    saveDb()
  } else {
    const instance = new SQL.Database()
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try { instance.run(stmt + ';') } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) throw e
      }
    }
    // Run migrations for fresh DB too, so PRAGMA user_version is set and any
    // post-schema patches stay consistent with upgraded databases.
    migrateDb(instance)
    db = instance
    saveDb()
  }

  // Auto-save every 60 seconds to prevent data loss on crash
  if (!autoSaveInterval) {
    autoSaveInterval = setInterval(() => { if (db) saveDb() }, 60000)
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
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
  const dbPath = join(dbDir, 'data.db')
  const tmpPath = dbPath + '.tmp'
  let saved = false

  // Primary: atomic write via tmp file → rename
  try {
    const data = db.export()
    writeFileSync(tmpPath, Buffer.from(data))
    const { renameSync } = require('fs')
    renameSync(tmpPath, dbPath)
    saved = true
  } catch {
    // Fallback: direct write
    try {
      const data = db.export()
      writeFileSync(dbPath, Buffer.from(data))
      saved = true
    } catch {}
  }

  if (!saved) {
    // Log to debug file and throw — callers must not silently ignore this
    try {
      writeFileSync(
        join(dbDir, 'debug.log'),
        new Date().toISOString() + ' [saveDb] CRITICAL: Failed to write database to disk\n',
        { flag: 'a' }
      )
    } catch {}
    throw new Error('Database could not be saved to disk. Your data may be at risk.')
  }
}

// Increment this when adding new migrations below
const DB_TARGET_VERSION = 2

function migrateDb(database: Database): void {
  try {
    const vRes = database.exec('PRAGMA user_version')
    const currentVersion = (vRes[0]?.values[0]?.[0] as number) ?? 0
    if (currentVersion >= DB_TARGET_VERSION) return

    // Helper: run ALTER TABLE and ignore "duplicate column" errors
    const safeRun = (sql: string) => {
      try { database.run(sql) } catch {}
    }

    // v0 → v1: Rebuild students table to include all valid status values
    if (currentVersion < 1) {
      const schema = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'")
      const createSql = schema[0]?.values[0]?.[0] as string || ''
      if (createSql && !createSql.includes('on_leave')) {
        database.run('BEGIN TRANSACTION')
        try {
          const oldCount = (database.exec('SELECT COUNT(*) FROM students')[0]?.values[0]?.[0] as number) ?? 0
          database.run("CREATE TABLE IF NOT EXISTS students_new (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL, section_id INTEGER NOT NULL, student_uid TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn','promoted','failed','on_leave','transferred','passed_out')), enrollment_date DATE, photo TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id), FOREIGN KEY (section_id) REFERENCES sections(id))")
          database.run("INSERT INTO students_new (id, school_id, section_id, student_uid, status, enrollment_date, photo, created_at) SELECT id, school_id, section_id, student_uid, CASE WHEN status IN ('active','withdrawn','promoted','failed','on_leave','transferred','passed_out') THEN status ELSE 'active' END, enrollment_date, photo, created_at FROM students")
          const newCount = (database.exec('SELECT COUNT(*) FROM students_new')[0]?.values[0]?.[0] as number) ?? 0
          if (newCount !== oldCount) {
            database.run('ROLLBACK')
            console.error(`migrateDb v1: row count mismatch (old=${oldCount}, new=${newCount}). Aborted.`)
            return
          }
          database.run('DROP TABLE students')
          database.run('ALTER TABLE students_new RENAME TO students')
          database.run('CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id)')
          database.run('CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)')
          database.run('COMMIT')
          console.log(`migrateDb v1: students rebuilt (${newCount} rows)`)
        } catch (e: any) {
          database.run('ROLLBACK')
          console.error('migrateDb v1: failed, rolled back:', e.message)
          return
        }
      }
    }

    // v1 → v2: Add columns that may be absent in databases created before these fields existed
    if (currentVersion < 2) {
      safeRun("ALTER TABLE exams ADD COLUMN exam_type TEXT DEFAULT 'minor'")
      safeRun('ALTER TABLE exams ADD COLUMN weight_percentage REAL DEFAULT 100')
      safeRun('ALTER TABLE exams ADD COLUMN class_id INTEGER REFERENCES classes(id)')
      safeRun('ALTER TABLE exams ADD COLUMN is_completed INTEGER DEFAULT 0')
      safeRun('ALTER TABLE exams ADD COLUMN max_marks REAL DEFAULT 100')
      safeRun('ALTER TABLE students ADD COLUMN photo TEXT')
      safeRun('ALTER TABLE promotions ADD COLUMN reason TEXT')
      console.log('migrateDb v2: column patches applied')
    }

    database.run(`PRAGMA user_version = ${DB_TARGET_VERSION}`)
    console.log(`migrateDb: schema now at version ${DB_TARGET_VERSION}`)
  } catch (e: any) {
    console.error('migrateDb: failed:', e.message)
  }
}

export function closeDb(): void {
  saveDb()
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
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
