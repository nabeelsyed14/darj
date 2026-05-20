import { queryAll, queryRun } from '../connection'

export function createSubject(schoolId: number, classId: number, name: string, passingMarks: number | null): number {
  const result = queryRun(
    'INSERT INTO subjects (school_id, class_id, name, passing_marks) VALUES (?, ?, ?, ?)',
    [schoolId, classId, name, passingMarks]
  )
  return result.lastInsertRowid
}

export function getSubjectsByClass(classId: number) {
  return queryAll('SELECT * FROM subjects WHERE class_id = ?', [classId])
}

export function deleteSubject(id: number): void {
  queryRun('DELETE FROM subjects WHERE id = ?', [id])
}

export function createExam(schoolId: number, academicYear: string, name: string, examDate: string | null, examType: string = 'minor', weightPercentage: number = 100, classId?: number, maxMarks: number = 100): number {
  const result = queryRun(
    'INSERT INTO exams (school_id, academic_year, name, exam_date, exam_type, weight_percentage, class_id, max_marks, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [schoolId, academicYear, name, examDate, examType, weightPercentage, classId || null, maxMarks]
  )
  return result.lastInsertRowid
}

export function getExams(schoolId: number, academicYear: string) {
  return queryAll('SELECT * FROM exams WHERE school_id = ? AND academic_year = ? ORDER BY exam_date', [schoolId, academicYear])
}

export function getExamsByClass(classId: number, academicYear: string) {
  return queryAll('SELECT * FROM exams WHERE class_id = ? AND academic_year = ? ORDER BY exam_date', [classId, academicYear])
}

export function markExamCompleted(examId: number, actualDate: string): void {
  queryRun('UPDATE exams SET is_completed = 1, exam_date = ? WHERE id = ?', [actualDate, examId])
}

export function deleteExam(id: number): void {
  queryRun('DELETE FROM exams WHERE id = ?', [id])
}

export function upsertMark(data: {
  student_id: number
  subject_id: number
  exam_id: number
  marks_obtained: number | null
  max_marks: number
  passing_marks: number | null
}): void {
  const isPass = data.marks_obtained !== null && data.passing_marks !== null
    ? (data.marks_obtained >= data.passing_marks ? 1 : 0)
    : null

  queryRun(
    `INSERT INTO marks (student_id, subject_id, exam_id, marks_obtained, max_marks, passing_marks, is_pass)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, subject_id, exam_id) DO UPDATE SET
       marks_obtained = excluded.marks_obtained,
       max_marks = excluded.max_marks,
       passing_marks = excluded.passing_marks,
       is_pass = excluded.is_pass`,
    [data.student_id, data.subject_id, data.exam_id, data.marks_obtained, data.max_marks, data.passing_marks, isPass]
  )
}

export function getMarksByExam(examId: number) {
  return queryAll('SELECT * FROM marks WHERE exam_id = ?', [examId])
}

export function getMarksByStudent(studentId: number) {
  return queryAll(
    `SELECT m.*, s.name as subject_name, s.passing_marks as subject_passing_marks,
            e.name as exam_name, e.exam_type, e.exam_date, e.weight_percentage
     FROM marks m
     JOIN subjects s ON m.subject_id = s.id
     JOIN exams e ON m.exam_id = e.id
     WHERE m.student_id = ?
     ORDER BY e.exam_date, s.name`,
    [studentId]
  )
}

export function getClassMarks(classId: number, examId: number) {
  return queryAll(
    `SELECT st.id as student_id, st.student_uid, sfv.value_text as full_name,
            m.subject_id, m.marks_obtained, m.max_marks, m.passing_marks, m.is_pass
     FROM students st
     LEFT JOIN marks m ON m.student_id = st.id AND m.exam_id = ?
     LEFT JOIN student_field_values sfv ON sfv.student_id = st.id
     LEFT JOIN student_fields sf ON sfv.field_id = sf.id AND sf.field_key = 'full_name'
     WHERE st.section_id IN (SELECT id FROM sections WHERE class_id = ?) AND st.status = 'active'`,
    [examId, classId]
  )
}

// Returns all marks for a school year — used for bulk pre-fetch to avoid N+1 loops
export function getMarksBySchool(schoolId: number, academicYear: string) {
  return queryAll(
    `SELECT m.student_id, m.marks_obtained, m.is_pass,
            sub.name as subject_name, sub.passing_marks,
            e.name as exam_name, e.weight_percentage, e.is_completed
     FROM marks m
     JOIN exams e ON m.exam_id = e.id
     JOIN subjects sub ON m.subject_id = sub.id
     WHERE e.school_id = ? AND e.academic_year = ?`,
    [schoolId, academicYear]
  )
}

// Returns all marks for a class across all exams in a year — used by PromotionReview
export function getMarksByClass(classId: number, academicYear: string) {
  return queryAll(
    `SELECT m.student_id, m.marks_obtained, m.max_marks, m.is_pass,
            sub.name as subject_name, sub.passing_marks,
            e.name as exam_name, e.weight_percentage
     FROM marks m
     JOIN exams e ON m.exam_id = e.id
     JOIN subjects sub ON m.subject_id = sub.id
     WHERE sub.class_id = ? AND e.academic_year = ?`,
    [classId, academicYear]
  )
}
