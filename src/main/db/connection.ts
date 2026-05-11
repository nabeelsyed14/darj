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
    db = new SQL.Database(buffer)
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
