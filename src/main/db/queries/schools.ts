import { queryOne, queryRun } from '../connection'

export function createSchool(data: {
  name: string
  address: string
  principal_name: string
  academic_year: string
  uid_prefix: string
}): number {
  const result = queryRun(
    'INSERT INTO schools (name, address, principal_name, academic_year, uid_prefix) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.address, data.principal_name, data.academic_year, data.uid_prefix]
  )
  return result.lastInsertRowid
}

export function getSchool(): Record<string, any> | null {
  return queryOne('SELECT * FROM schools LIMIT 1')
}

export function updateSchool(data: {
  id: number
  name: string
  address: string
  principal_name: string
  academic_year: string
  uid_prefix: string
}): void {
  queryRun(
    'UPDATE schools SET name = ?, address = ?, principal_name = ?, academic_year = ?, uid_prefix = ? WHERE id = ?',
    [data.name, data.address, data.principal_name, data.academic_year, data.uid_prefix, data.id]
  )
}

export function isSetupComplete(): boolean {
  const result = queryOne('SELECT COUNT(*) as count FROM schools')
  return (result?.count ?? 0) > 0
}

