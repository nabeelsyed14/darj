import { queryOne, queryRun } from '../connection'

export function createSchool(data: {
  name: string
  address: string
  principal_name: string
  academic_year: string
  uid_prefix: string
}): number {
  const existing = queryOne('SELECT id FROM schools ORDER BY id DESC LIMIT 1') as { id: number } | null
  if (existing?.id) {
    const current = queryOne('SELECT * FROM schools WHERE id = ?', [existing.id]) as any
    const name = data.name?.trim() ? data.name : (current?.name || '')
    const address = data.address ?? (current?.address || '')
    const principalName = data.principal_name ?? (current?.principal_name || '')
    const academicYear = data.academic_year?.trim() ? data.academic_year : (current?.academic_year || '')
    const uidPrefix = data.uid_prefix?.trim() ? data.uid_prefix : (current?.uid_prefix || 'SCH')
    queryRun(
      'UPDATE schools SET name = ?, address = ?, principal_name = ?, academic_year = ?, uid_prefix = ? WHERE id = ?',
      [name, address, principalName, academicYear, uidPrefix, existing.id]
    )
    return existing.id
  }

  const result = queryRun(
    'INSERT INTO schools (name, address, principal_name, academic_year, uid_prefix) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.address, data.principal_name, data.academic_year, data.uid_prefix]
  )
  return result.lastInsertRowid
}

export function getSchool(): Record<string, any> | null {
  return queryOne(
    `SELECT *
     FROM schools
     ORDER BY
       CASE WHEN TRIM(COALESCE(name, '')) <> '' THEN 1 ELSE 0 END DESC,
       CASE WHEN TRIM(COALESCE(academic_year, '')) <> '' THEN 1 ELSE 0 END DESC,
       id DESC
     LIMIT 1`
  )
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
  const result = queryOne(
    `SELECT COUNT(*) as count
     FROM schools
     WHERE TRIM(COALESCE(name, '')) <> ''`
  )
  return (result?.count ?? 0) > 0
}

