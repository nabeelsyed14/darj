import { queryOne, queryAll, queryRun } from '../connection'

export function createSection(classId: number, name: string, classTeacherName: string | null): number {
  const result = queryRun(
    'INSERT INTO sections (class_id, name, class_teacher_name) VALUES (?, ?, ?)',
    [classId, name, classTeacherName]
  )
  return result.lastInsertRowid
}

export function getSectionsByClass(classId: number) {
  return queryAll(
    `SELECT s.*, (SELECT COUNT(*) FROM students st WHERE st.section_id = s.id AND st.status = 'active') as student_count
     FROM sections s WHERE s.class_id = ?`,
    [classId]
  )
}

export function getAllSections(schoolId: number) {
  return queryAll(
    `SELECT s.*, c.name as class_name
     FROM sections s
     JOIN classes c ON s.class_id = c.id
     WHERE c.school_id = ?`,
    [schoolId]
  )
}

export function updateSection(id: number, data: { name?: string; class_teacher_name?: string | null }): void {
  if (data.name !== undefined) {
    queryRun('UPDATE sections SET name = ? WHERE id = ?', [data.name, id])
  }
  if (data.class_teacher_name !== undefined) {
    queryRun('UPDATE sections SET class_teacher_name = ? WHERE id = ?', [data.class_teacher_name, id])
  }
}

export function deleteSection(id: number): void {
  queryRun('DELETE FROM sections WHERE id = ?', [id])
}

export function getSection(id: number) {
  return queryOne('SELECT * FROM sections WHERE id = ?', [id])
}
