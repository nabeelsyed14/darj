import { queryOne, queryAll, queryRun } from '../connection'

export function generateStudentUid(schoolId: number): string {
  const school = queryOne('SELECT uid_prefix FROM schools WHERE id = ?', [schoolId]) as { uid_prefix: string }
  const prefix = school?.uid_prefix || 'SCH'
  const year = new Date().getFullYear()
  const count = queryOne('SELECT COUNT(*) as count FROM students WHERE school_id = ?', [schoolId]) as { count: number }
  const seq = String(count.count + 1).padStart(4, '0')
  return `${prefix}-${year}-${seq}`
}

export function createStudent(data: {
  school_id: number
  section_id: number
  enrollment_date: string
  field_values: { field_id: number; value: string | number | null }[]
}): number {
  const studentUid = generateStudentUid(data.school_id)

  const studentResult = queryRun(
    'INSERT INTO students (school_id, section_id, student_uid, enrollment_date) VALUES (?, ?, ?, ?)',
    [data.school_id, data.section_id, studentUid, data.enrollment_date]
  )

  const studentId = studentResult.lastInsertRowid

  for (const v of data.field_values) {
    if (v.value === null || v.value === '') continue
    const isDate = typeof v.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.value)
    const isNumber = typeof v.value === 'number'
    queryRun(
      'INSERT INTO student_field_values (student_id, field_id, value_text, value_date, value_number) VALUES (?, ?, ?, ?, ?)',
      [studentId, v.field_id, isDate || isNumber ? null : String(v.value), isDate ? v.value : null, isNumber ? v.value : null]
    )
  }

  return studentId
}

export function getStudent(id: number) {
  const student = queryOne('SELECT * FROM students WHERE id = ?', [id])
  if (!student) return null

  const fields = queryAll(
    `SELECT sf.field_key, sf.display_name, sf.field_type, sfv.value_text, sfv.value_date, sfv.value_number
     FROM student_field_values sfv
     JOIN student_fields sf ON sfv.field_id = sf.id
     WHERE sfv.student_id = ? AND sf.is_active = 1
     ORDER BY sf.display_order`,
    [id]
  )

  ;(student as any).field_values = {}
  for (const f of fields) {
    ;(student as any).field_values[f.field_key] = f.value_date ?? f.value_number ?? f.value_text ?? ''
  }

  return student
}

export function getStudentsBySection(sectionId: number) {
  const students = queryAll(
    "SELECT * FROM students WHERE section_id = ? AND status = 'active' ORDER BY id",
    [sectionId]
  )

  for (const student of students) {
    const fields = queryAll(
      `SELECT sf.field_key, sfv.value_text, sfv.value_date, sfv.value_number
       FROM student_field_values sfv
       JOIN student_fields sf ON sfv.field_id = sf.id
       WHERE sfv.student_id = ? AND sf.is_active = 1
       ORDER BY sf.display_order`,
      [student.id]
    )

    ;(student as any).field_values = {}
    for (const f of fields) {
      ;(student as any).field_values[f.field_key] = f.value_date ?? f.value_number ?? f.value_text ?? ''
    }
  }

  return students
}

export function updateStudent(id: number, data: {
  section_id?: number
  enrollment_date?: string
  field_values?: { field_id: number; value: string | number | null }[]
}): void {
  if (data.section_id !== undefined) {
    queryRun('UPDATE students SET section_id = ? WHERE id = ?', [data.section_id, id])
  }
  if (data.enrollment_date !== undefined) {
    queryRun('UPDATE students SET enrollment_date = ? WHERE id = ?', [data.enrollment_date, id])
  }
  if (data.field_values) {
    for (const v of data.field_values) {
      if (v.value === null || v.value === '') {
        queryRun('DELETE FROM student_field_values WHERE student_id = ? AND field_id = ?', [id, v.field_id])
        continue
      }
      const isDate = typeof v.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.value)
      const isNumber = typeof v.value === 'number'
      queryRun(
        `INSERT INTO student_field_values (student_id, field_id, value_text, value_date, value_number)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(student_id, field_id) DO UPDATE SET
           value_text = excluded.value_text,
           value_date = excluded.value_date,
           value_number = excluded.value_number`,
        [id, v.field_id, isDate || isNumber ? null : String(v.value), isDate ? v.value : null, isNumber ? v.value : null]
      )
    }
  }
}

export function withdrawStudent(id: number): void {
  queryRun("UPDATE students SET status = 'withdrawn' WHERE id = ?", [id])
}

export function moveStudent(id: number, newSectionId: number): void {
  queryRun('UPDATE students SET section_id = ? WHERE id = ?', [newSectionId, id])
}

export function searchStudents(query: string, schoolId: number) {
  const students = queryAll(
    "SELECT * FROM students WHERE school_id = ? AND status = 'active' ORDER BY id",
    [schoolId]
  )

  const lowerQuery = query.toLowerCase()
  return students.filter((student: any) => {
    if (student.student_uid.toLowerCase().includes(lowerQuery)) return true
    const fields = queryAll(
      `SELECT sf.field_key, sfv.value_text, sfv.value_date, sfv.value_number
       FROM student_field_values sfv
       JOIN student_fields sf ON sfv.field_id = sf.id
       WHERE sfv.student_id = ? AND sf.is_searchable = 1`,
      [student.id]
    )

    return fields.some((f: any) => {
      const val = f.value_date ?? f.value_number ?? f.value_text ?? ''
      return String(val).toLowerCase().includes(lowerQuery)
    })
  })
}

export function updateStudentPhoto(id: number, photoDataUrl: string): void {
  queryRun('UPDATE students SET photo = ? WHERE id = ?', [photoDataUrl, id])
}
