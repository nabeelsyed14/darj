import { queryOne, queryAll, queryRun } from '../connection'

export function getDefaultFields(): { field_key: string; display_name: string; field_type: string; is_searchable: number }[] {
  return [
    { field_key: 'full_name', display_name: 'Full Name', field_type: 'text', is_searchable: 1 },
    { field_key: 'fathers_name', display_name: "Father's Name", field_type: 'text', is_searchable: 0 },
    { field_key: 'mothers_name', display_name: "Mother's Name", field_type: 'text', is_searchable: 0 },
    { field_key: 'date_of_birth', display_name: 'Date of Birth', field_type: 'date', is_searchable: 0 },
    { field_key: 'gender', display_name: 'Gender', field_type: 'text', is_searchable: 1 },
    { field_key: 'pen_number', display_name: 'PEN Number', field_type: 'text', is_searchable: 1 },
    { field_key: 'sr_number', display_name: 'SR Number', field_type: 'text', is_searchable: 1 },
    { field_key: 'aadhaar_number', display_name: 'Aadhaar Number', field_type: 'text', is_searchable: 0 },
    { field_key: 'blood_group', display_name: 'Blood Group', field_type: 'text', is_searchable: 0 },
    { field_key: 'height', display_name: 'Height', field_type: 'number', is_searchable: 0 },
    { field_key: 'weight', display_name: 'Weight', field_type: 'number', is_searchable: 0 },
    { field_key: 'address', display_name: 'Address', field_type: 'text', is_searchable: 0 },
    { field_key: 'enrollment_date', display_name: 'Enrollment Date', field_type: 'date', is_searchable: 0 },
    { field_key: 'phone_number', display_name: 'Phone Number', field_type: 'text', is_searchable: 0 },
  ]
}

export function createFields(schoolId: number, fields: { field_key: string; display_name: string; field_type: string; is_searchable: number }[]): void {
  fields.forEach((f, i) => {
    queryRun(
      'INSERT INTO student_fields (school_id, field_key, display_name, field_type, is_searchable, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [schoolId, f.field_key, f.display_name, f.field_type, f.is_searchable, i]
    )
  })
}

export function getFields(schoolId: number) {
  return queryAll(
    'SELECT * FROM student_fields WHERE school_id = ? AND is_active = 1 ORDER BY display_order',
    [schoolId]
  )
}

export function getAllFields(schoolId: number) {
  return queryAll(
    'SELECT * FROM student_fields WHERE school_id = ? ORDER BY display_order',
    [schoolId]
  )
}

export function addField(data: { school_id: number; field_key: string; display_name: string; field_type: string; is_searchable: number }): void {
  const maxOrder = queryOne(
    'SELECT MAX(display_order) as max_order FROM student_fields WHERE school_id = ?',
    [data.school_id]
  ) as { max_order: number | null }

  queryRun(
    'INSERT INTO student_fields (school_id, field_key, display_name, field_type, is_searchable, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [data.school_id, data.field_key, data.display_name, data.field_type, data.is_searchable, (maxOrder?.max_order ?? -1) + 1]
  )
}

export function updateField(id: number, data: { display_name?: string; field_type?: string; is_searchable?: number }): void {
  if (data.display_name !== undefined) {
    queryRun('UPDATE student_fields SET display_name = ? WHERE id = ?', [data.display_name, id])
  }
  if (data.field_type !== undefined) {
    queryRun('UPDATE student_fields SET field_type = ? WHERE id = ?', [data.field_type, id])
  }
  if (data.is_searchable !== undefined) {
    queryRun('UPDATE student_fields SET is_searchable = ? WHERE id = ?', [data.is_searchable, id])
  }
}

export function removeField(id: number): void {
  queryRun('UPDATE student_fields SET is_active = 0 WHERE id = ?', [id])
}

export function reorderFields(fieldIds: number[]): void {
  fieldIds.forEach((id, i) => {
    queryRun('UPDATE student_fields SET display_order = ? WHERE id = ?', [i, id])
  })
}
