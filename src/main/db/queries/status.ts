import { queryAll, queryRun } from '../connection'

export function updateStudentStatus(
  studentId: number, oldStatus: string, newStatus: string,
  reason: string, effectiveDate: string
): void {
  queryRun('UPDATE students SET status = ? WHERE id = ?', [newStatus, studentId])
  queryRun(
    'INSERT INTO status_history (student_id, old_status, new_status, reason, effective_date) VALUES (?, ?, ?, ?, ?)',
    [studentId, oldStatus, newStatus, reason, effectiveDate]
  )
}

export function getStatusHistory(studentId: number) {
  return queryAll('SELECT * FROM status_history WHERE student_id = ? ORDER BY changed_at DESC', [studentId])
}
