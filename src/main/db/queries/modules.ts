import { queryOne, queryAll, queryRun } from '../connection'

export function enableModules(schoolId: number, moduleKeys: string[]): void {
  moduleKeys.forEach(key => {
    queryRun(
      `INSERT INTO modules (school_id, module_key, is_enabled) VALUES (?, ?, 1)
       ON CONFLICT(school_id, module_key) DO UPDATE SET is_enabled = 1`,
      [schoolId, key]
    )
  })
}

export function getModules(schoolId: number) {
  return queryAll('SELECT * FROM modules WHERE school_id = ?', [schoolId])
}

export function toggleModule(schoolId: number, moduleKey: string, enabled: boolean): void {
  const val = enabled ? 1 : 0
  queryRun(
    `INSERT INTO modules (school_id, module_key, is_enabled) VALUES (?, ?, ?)
     ON CONFLICT(school_id, module_key) DO UPDATE SET is_enabled = ?`,
    [schoolId, moduleKey, val, val]
  )
}

export function isModuleEnabled(schoolId: number, moduleKey: string): boolean {
  const result = queryOne(
    'SELECT is_enabled FROM modules WHERE school_id = ? AND module_key = ?',
    [schoolId, moduleKey]
  ) as { is_enabled: number } | undefined
  return result?.is_enabled === 1
}
