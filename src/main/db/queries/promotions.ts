import { queryAll, queryRun } from '../connection'

export function promoteStudent(data: {
  student_id: number
  from_section_id: number
  to_section_id: number | null
  academic_year: string
  status: string
  reason?: string | null
}): void {
  // Keep one promotion decision per student per academic year.
  // This prevents double-promotion side effects when teachers edit decisions.
  queryRun(
    'DELETE FROM promotions WHERE student_id = ? AND academic_year = ?',
    [data.student_id, data.academic_year]
  )

  queryRun(
    'INSERT INTO promotions (student_id, from_section_id, to_section_id, academic_year, status, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [data.student_id, data.from_section_id, data.to_section_id, data.academic_year, data.status, data.reason || null]
  )
  // Important: do NOT move/change student records here.
  // Actual movement/passout happens only during Year End rollover finalization.
}

export function getPromotionsByYear(academicYear: string) {
  return queryAll('SELECT * FROM promotions WHERE academic_year = ?', [academicYear])
}

export function getStudentPromotions(studentId: number) {
  return queryAll('SELECT * FROM promotions WHERE student_id = ? ORDER BY promotion_date', [studentId])
}

export function finalizeRolloverForYear(schoolId: number, academicYear: string, finalClassName: string | null): void {
  const promotions = queryAll(
    `SELECT p.student_id, p.status, p.to_section_id, st.section_id
     FROM promotions p
     JOIN students st ON st.id = p.student_id
     WHERE p.academic_year = ?`,
    [academicYear]
  )

  const finalSectionIds = finalClassName
    ? new Set(
      queryAll(
        `SELECT s.id
         FROM sections s
         JOIN classes c ON s.class_id = c.id
         WHERE c.school_id = ? AND c.name = ?`,
        [schoolId, finalClassName]
      ).map((r: any) => r.id)
    )
    : new Set<number>()

  for (const p of promotions) {
    if (p.status === 'promoted') {
      if (p.to_section_id) {
        queryRun("UPDATE students SET section_id = ?, status = 'active' WHERE id = ?", [p.to_section_id, p.student_id])
      } else {
        const isFinalClassStudent = finalSectionIds.has(p.section_id)
        if (isFinalClassStudent) {
          queryRun("UPDATE students SET status = 'passed_out' WHERE id = ?", [p.student_id])
        } else {
          queryRun("UPDATE students SET status = 'active' WHERE id = ?", [p.student_id])
        }
      }
    } else if (p.status === 'failed') {
      queryRun("UPDATE students SET status = 'active' WHERE id = ?", [p.student_id])
    }
  }
}
