import { queryOne, queryAll, queryRun } from '../connection'

export function generateStudentUid(schoolId: number): string {
  const school = queryOne('SELECT uid_prefix FROM schools WHERE id = ?', [schoolId]) as { uid_prefix: string }
  const prefix = school?.uid_prefix || 'SCH'
  const year = new Date().getFullYear()
  // Use MAX(id) instead of COUNT(*) to avoid collisions when students are deleted
  const maxRow = queryOne('SELECT MAX(id) as max_id FROM students WHERE school_id = ?', [schoolId]) as { max_id: number | null }
  const seq = String((maxRow?.max_id ?? 0) + 1).padStart(4, '0')
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

export function getAllStudentsBySection(sectionId: number) {
  const students = queryAll(
    'SELECT * FROM students WHERE section_id = ? ORDER BY id',
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

export function deleteStudent(id: number): void {
  // Remove dependent records first for databases without ON DELETE CASCADE on these tables.
  queryRun('DELETE FROM attendance WHERE student_id = ?', [id])
  queryRun('DELETE FROM marks WHERE student_id = ?', [id])
  queryRun('DELETE FROM promotions WHERE student_id = ?', [id])
  queryRun('DELETE FROM status_history WHERE student_id = ?', [id])
  queryRun('DELETE FROM student_field_values WHERE student_id = ?', [id])
  queryRun('DELETE FROM students WHERE id = ?', [id])
}

export function searchStudents(query: string, schoolId: number) {
  // Single JOIN: fetch all active students with their searchable field values at once
  const rows = queryAll(
    `SELECT st.id, st.student_uid, st.section_id, st.status, st.enrollment_date, st.photo,
            sf.field_key, sfv.value_text, sfv.value_date, sfv.value_number
     FROM students st
     LEFT JOIN student_field_values sfv ON sfv.student_id = st.id
     LEFT JOIN student_fields sf ON sfv.field_id = sf.id AND sf.is_searchable = 1
     WHERE st.school_id = ? AND st.status = 'active'
     ORDER BY st.id`,
    [schoolId]
  )

  // Group rows by student id in memory
  const studentMap = new Map<number, any>()
  for (const row of rows) {
    if (!studentMap.has(row.id)) {
      studentMap.set(row.id, {
        id: row.id,
        student_uid: row.student_uid,
        section_id: row.section_id,
        status: row.status,
        enrollment_date: row.enrollment_date,
        photo: row.photo,
        searchableValues: [] as string[]
      })
    }
    const val = row.value_date ?? row.value_number ?? row.value_text ?? ''
    if (val !== '') studentMap.get(row.id)!.searchableValues.push(String(val).toLowerCase())
  }

  const lowerQuery = query.toLowerCase()
  return [...studentMap.values()].filter((student) => {
    if (student.student_uid.toLowerCase().includes(lowerQuery)) return true
    return student.searchableValues.some((v: string) => v.includes(lowerQuery))
  })
}

export function updateStudentPhoto(id: number, photoDataUrl: string): void {
  queryRun('UPDATE students SET photo = ? WHERE id = ?', [photoDataUrl, id])
}

// Fetches all students for a school with basic class/section info attached
export function getAllBySchool(schoolId: number) {
  const students = queryAll(
    `SELECT st.*, sec.name as section_name, c.name as class_name, c.id as class_id,
            fn.value_text as full_name
     FROM students st
     JOIN sections sec ON st.section_id = sec.id
     JOIN classes c ON sec.class_id = c.id
     LEFT JOIN student_field_values fn ON fn.student_id = st.id
       AND fn.field_id = (
         SELECT sf.id
         FROM student_fields sf
         WHERE sf.school_id = st.school_id AND sf.field_key = 'full_name'
         LIMIT 1
       )
     WHERE st.school_id = ? AND st.status = 'active'
     ORDER BY st.id`,
    [schoolId]
  )

  if (students.length === 0) return students

  const fieldRows = queryAll(
    `SELECT sfv.student_id, sf.field_key, sfv.value_text, sfv.value_date, sfv.value_number
     FROM student_field_values sfv
     JOIN student_fields sf ON sfv.field_id = sf.id
     JOIN students st ON st.id = sfv.student_id
     WHERE st.school_id = ? AND st.status = 'active' AND sf.is_active = 1`,
    [schoolId]
  )

  const fieldMap = new Map<number, Record<string, any>>()
  for (const row of fieldRows) {
    if (!fieldMap.has(row.student_id)) fieldMap.set(row.student_id, {})
    fieldMap.get(row.student_id)![row.field_key] = row.value_date ?? row.value_number ?? row.value_text ?? ''
  }

  for (const st of students as any[]) {
    st.field_values = fieldMap.get(st.id) || {}
    if (!st.full_name && st.field_values?.full_name) st.full_name = st.field_values.full_name
  }

  return students
}

