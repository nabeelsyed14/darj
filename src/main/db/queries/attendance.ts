import { queryAll, queryRun } from '../connection'

export function markAttendance(data: {
  school_id: number
  student_id: number
  section_id: number
  date: string
  status: string
}): void {
  queryRun(
    `INSERT INTO attendance (school_id, student_id, section_id, date, status)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = ?`,
    [data.school_id, data.student_id, data.section_id, data.date, data.status, data.status]
  )
}

export function markAttendanceBulk(records: {
  school_id: number
  student_id: number
  section_id: number
  date: string
  status: string
}[]): void {
  for (const r of records) {
    queryRun(
      `INSERT INTO attendance (school_id, student_id, section_id, date, status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(student_id, date) DO UPDATE SET status = ?`,
      [r.school_id, r.student_id, r.section_id, r.date, r.status, r.status]
    )
  }
}

export function getAttendanceByDate(sectionId: number, date: string) {
  return queryAll(
    'SELECT * FROM attendance WHERE section_id = ? AND date = ?',
    [sectionId, date]
  )
}

export function getAttendanceByStudent(studentId: number, startDate: string, endDate: string) {
  return queryAll(
    'SELECT * FROM attendance WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date',
    [studentId, startDate, endDate]
  )
}

export function getAttendanceSummary(sectionId: number, startDate: string, endDate: string) {
  return queryAll(
    `SELECT student_id,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count
     FROM attendance
     WHERE section_id = ? AND date BETWEEN ? AND ?
     GROUP BY student_id`,
    [sectionId, startDate, endDate]
  )
}

