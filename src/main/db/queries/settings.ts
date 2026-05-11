import { queryOne, queryAll, queryRun } from '../connection'

export function getSetting(schoolId: number, key: string): string | null {
  const result = queryOne('SELECT value FROM settings WHERE school_id = ? AND key = ?', [schoolId, key]) as { value: string } | undefined
  return result?.value ?? null
}

export function setSetting(schoolId: number, key: string, value: string): void {
  queryRun(
    'INSERT INTO settings (school_id, key, value) VALUES (?, ?, ?) ON CONFLICT(school_id, key) DO UPDATE SET value = ?',
    [schoolId, key, value, value]
  )
}

export function getAllSettings(schoolId: number) {
  return queryAll('SELECT * FROM settings WHERE school_id = ?', [schoolId])
}
