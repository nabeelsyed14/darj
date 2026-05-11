import { queryOne, queryAll, queryRun } from '../connection'

export function createClass(schoolId: number, name: string): number {
  const maxOrder = queryOne('SELECT MAX(display_order) as max_order FROM classes WHERE school_id = ?', [schoolId]) as { max_order: number | null }
  const result = queryRun(
    'INSERT INTO classes (school_id, name, display_order) VALUES (?, ?, ?)',
    [schoolId, name, (maxOrder?.max_order ?? -1) + 1]
  )
  return result.lastInsertRowid
}

export function getClasses(schoolId: number) {
  return queryAll('SELECT * FROM classes WHERE school_id = ? ORDER BY display_order', [schoolId])
}

export function updateClass(id: number, name: string): void {
  queryRun('UPDATE classes SET name = ? WHERE id = ?', [name, id])
}

export function deleteClass(id: number): void {
  queryRun('DELETE FROM classes WHERE id = ?', [id])
}

export function reorderClass(id: number, newOrder: number): void {
  queryRun('UPDATE classes SET display_order = ? WHERE id = ?', [newOrder, id])
}

