import { queryOne, queryAll, queryRun, saveDb } from '../connection'

export function archiveYear(schoolId: number, academicYear: string): void {
  const schools = queryOne('SELECT * FROM schools WHERE id = ?', [schoolId])
  const classes = queryAll('SELECT * FROM classes WHERE school_id = ? ORDER BY display_order', [schoolId])
  const sections = queryAll('SELECT s.*, c.name as class_name FROM sections s JOIN classes c ON s.class_id = c.id WHERE c.school_id = ?', [schoolId])
  const fields = queryAll('SELECT * FROM student_fields WHERE school_id = ? AND is_active = 1 ORDER BY display_order', [schoolId])
  const attendance = queryAll('SELECT * FROM attendance WHERE school_id = ?', [schoolId])
  const subjects = queryAll('SELECT sub.* FROM subjects sub JOIN classes c ON sub.class_id = c.id WHERE c.school_id = ?', [schoolId])
  const exams = queryAll('SELECT * FROM exams WHERE school_id = ? AND academic_year = ?', [schoolId, academicYear])
  const marks = queryAll(
    `SELECT m.*, sub.name as subject_name, sub.passing_marks
     FROM marks m
     JOIN exams e ON m.exam_id = e.id
     JOIN subjects sub ON m.subject_id = sub.id
     WHERE e.school_id = ? AND e.academic_year = ?`,
    [schoolId, academicYear]
  )

  // Build resolved student list with names, class, section, result
  const students = queryAll(
    `SELECT st.id, st.student_uid, st.status, st.section_id
     FROM students st
     WHERE st.school_id = ?`,
    [schoolId]
  )

  const promotions = queryAll(
    `SELECT p.*, sfv.value_text as full_name
     FROM promotions p
     LEFT JOIN student_field_values sfv ON sfv.student_id = p.student_id
     LEFT JOIN student_fields sf ON sfv.field_id = sf.id AND sf.field_key = 'full_name'
     WHERE p.academic_year = ?`,
    [academicYear]
  )

  const promoMap: Record<number, any> = {}
  for (const p of promotions) { promoMap[p.student_id] = p }

  const sectionMap: Record<number, any> = {}
  for (const s of sections) { sectionMap[s.id] = s }

  // Pre-fetch ALL field values for ALL students in a single query
  const allFieldValues = queryAll(
    `SELECT sfv.student_id, sf.field_key, sfv.value_text, sfv.value_date, sfv.value_number
     FROM student_field_values sfv
     JOIN student_fields sf ON sfv.field_id = sf.id
     JOIN students st ON sfv.student_id = st.id
     WHERE st.school_id = ?`,
    [schoolId]
  )
  // Group by student_id in memory — O(n) instead of O(n) queries
  const fieldValuesByStudent: Record<number, Record<string, any>> = {}
  for (const fv of allFieldValues) {
    if (!fieldValuesByStudent[fv.student_id]) fieldValuesByStudent[fv.student_id] = {}
    fieldValuesByStudent[fv.student_id][fv.field_key] = fv.value_date ?? fv.value_number ?? fv.value_text ?? ''
  }

  // Build resolved students array using pre-fetched data — no extra queries
  const resolvedStudents = students.map((st: any) => {
    const sec = sectionMap[st.section_id]
    const promo = promoMap[st.id]
    const fieldValues = fieldValuesByStudent[st.id] || {}

    let result = st.status
    let promoStatus = promo?.status || null
    let promoReason = promo?.reason || null
    if (promoStatus === 'promoted') result = 'promoted'
    else if (promoStatus === 'failed') result = 'failed'
    else if (st.status === 'withdrawn') result = 'withdrawn'

    // Build marks summary
    const studentMarks = marks.filter((m: any) => m.student_id === st.id)
    const subjectNames = [...new Set(studentMarks.map((m: any) => m.subject_name))]
    const marksSummary = subjectNames.map((sub: string) => {
      const sm = studentMarks.filter((m: any) => m.subject_name === sub)
      const avg = sm.length > 0 ? Math.round(sm.reduce((a: number, m: any) => a + (m.marks_obtained || 0), 0) / sm.length) : 0
      const pass = sm.length > 0 && !sm.some((m: any) => m.is_pass === 0)
      return `${sub}: ${avg}% ${pass ? 'P' : 'F'}`
    }).join(', ')

    return {
      id: st.id,
      student_uid: st.student_uid,
      full_name: fieldValues['full_name'] || st.student_uid,
      class_name: sec?.class_name || '',
      section_name: sec?.name || '',
      status: st.status,
      result,
      promo_status: promoStatus,
      promo_reason: promoReason,
      marks_summary: marksSummary || 'No marks',
      field_values: fieldValues
    }
  })

  const data = {
    school: schools,
    classes,
    sections,
    fields,
    attendance,
    subjects,
    exams,
    marks,
    promotions,
    students: resolvedStudents
  }

  queryRun(
    'INSERT INTO archives (school_id, academic_year, data_blob) VALUES (?, ?, ?) ON CONFLICT(school_id, academic_year) DO UPDATE SET data_blob = ?',
    [schoolId, academicYear, JSON.stringify(data), JSON.stringify(data)]
  )

  saveDb()
}

export function getArchives(schoolId: number) {
  return queryAll('SELECT id, academic_year, archived_at FROM archives WHERE school_id = ? ORDER BY academic_year DESC', [schoolId])
}

export function getArchive(schoolId: number, academicYear: string) {
  const result = queryOne('SELECT data_blob FROM archives WHERE school_id = ? AND academic_year = ?', [schoolId, academicYear])
  if (!result) return null
  return JSON.parse(result.data_blob as string)
}

export function deleteArchive(id: number): void {
  queryRun('DELETE FROM archives WHERE id = ?', [id])
}

export function importArchiveData(schoolId: number, academicYear: string, students: any[]): void {
  const existing = queryOne('SELECT data_blob FROM archives WHERE school_id = ? AND academic_year = ?', [schoolId, academicYear])
  let data: any
  if (existing) {
    data = JSON.parse(existing.data_blob as string)
    const existingIds = new Set((data.students || []).map((s: any) => s.student_uid))
    const newStudents = students.filter((s: any) => !existingIds.has(s.student_uid))
    data.students = [...(data.students || []), ...newStudents.map((s: any) => ({
      id: data.students.length + Math.random() * 10000,
      student_uid: s.student_uid,
      full_name: s.full_name || s.student_uid,
      class_name: s.class_name || '',
      section_name: s.section_name || '',
      status: 'archived',
      result: s.result || 'unknown',
      promo_status: s.result === 'promoted' ? 'promoted' : s.result === 'failed' ? 'failed' : null,
      promo_reason: s.reason || null,
      marks_summary: s.marks_summary || '',
      field_values: {}
    }))]
  } else {
    data = {
      school: queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]),
      classes: queryAll('SELECT * FROM classes WHERE school_id = ?', [schoolId]),
      sections: queryAll('SELECT * FROM sections s JOIN classes c ON s.class_id = c.id WHERE c.school_id = ?', [schoolId]),
      fields: [],
      attendance: [],
      subjects: [],
      exams: [],
      marks: [],
      promotions: [],
      students: students.map((s: any, i: number) => ({
        id: i + 1,
        student_uid: s.student_uid,
        full_name: s.full_name || s.student_uid,
        class_name: s.class_name || '',
        section_name: s.section_name || '',
        status: 'archived',
        result: s.result || 'unknown',
        promo_status: s.result === 'promoted' ? 'promoted' : s.result === 'failed' ? 'failed' : null,
        promo_reason: s.reason || null,
        marks_summary: s.marks_summary || '',
        field_values: {}
      }))
    }
  }
  queryRun(
    'INSERT INTO archives (school_id, academic_year, data_blob) VALUES (?, ?, ?) ON CONFLICT(school_id, academic_year) DO UPDATE SET data_blob = ?',
    [schoolId, academicYear, JSON.stringify(data), JSON.stringify(data)]
  )
  saveDb()
}
