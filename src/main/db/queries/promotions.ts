import { queryAll, queryRun } from '../connection'

export function promoteStudent(data: {
  student_id: number
  from_section_id: number
  to_section_id: number | null
  academic_year: string
  status: string
  reason?: string | null
}): void {
  queryRun(
    'INSERT INTO promotions (student_id, from_section_id, to_section_id, academic_year, status, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [data.student_id, data.from_section_id, data.to_section_id, data.academic_year, data.status, data.reason || null]
  )

  if (data.status === 'promoted' && data.to_section_id) {
    queryRun("UPDATE students SET section_id = ?, status = 'active' WHERE id = ?", [data.to_section_id, data.student_id])
  } else if (data.status === 'failed') {
    queryRun("UPDATE students SET status = 'active' WHERE id = ?", [data.student_id])
  }
}

export function getPromotionsByYear(academicYear: string) {
  return queryAll('SELECT * FROM promotions WHERE academic_year = ?', [academicYear])
}

export function getStudentPromotions(studentId: number) {
  return queryAll('SELECT * FROM promotions WHERE student_id = ? ORDER BY promotion_date', [studentId])
}
