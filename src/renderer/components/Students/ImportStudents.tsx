import { useState, useEffect } from 'react'
import { Upload, Button, Table, Select, message, Typography, Space, Tabs, Tag, Modal, Alert } from 'antd'
import { UploadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'

const { Text, Title } = Typography

interface ImportStudentsProps {
  sections: { id: number; name: string; class_name: string }[]
  onComplete: () => void
}

interface GroupInfo {
  className: string
  sectionName: string
  count: number
  sectionId?: number
  exists: boolean
}

interface SheetData {
  name: string
  columns: string[]
  rows: Record<string, any>[]
  sectionId?: number
  mapping: Record<string, string>
  groups?: GroupInfo[]
  skippedColumns: string[]
  newFieldColumns: Record<string, string>
}

const ROMAN_MAP: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12
}

function convertRomanToNumber(val: string): string {
  const num = ROMAN_MAP[val.toLowerCase().trim()]
  return num ? `Class ${num}` : val
}

function findClassColumn(cols: string[]): string | null {
  const patterns = ['class', 'class name', 'grade', 'std', 'standard']
  return cols.find((c) => patterns.some((p) => c.toLowerCase().trim() === p)) || null
}

function findSectionColumn(cols: string[]): string | null {
  const patterns = ['section', 'sec', 'division', 'div']
  return cols.find((c) => patterns.some((p) => c.toLowerCase().trim() === p)) || null
}

const AUTO_MATCH_PATTERNS: Record<string, string[]> = {
  full_name: ['full name', 'name', 'student name'],
  fathers_name: ['father name', "father's name", 'fathers name', 'father', 'fathers'],
  mothers_name: ['mother name', "mother's name", 'mothers name', 'mother', 'mothers'],
  date_of_birth: ['date of birth', 'dob', 'birth date', 'birthday'],
  gender: ['gender', 'sex'],
  pen_number: ['pen number', 'pen no', 'pen', 'student pen'],
  sr_number: ['sr number', 'sr no', 'sr', 'admission no', 'admission number', 'admission'],
  aadhaar_number: ['aadhaar number', 'aadhaar no', 'aadhaar', 'uid'],
  blood_group: ['blood group', 'blood', 'blood type'],
  height: ['height', 'ht'],
  weight: ['weight', 'wt'],
  address: ['address', 'addr'],
  enrollment_date: ['enrollment date', 'enrolment date', 'admission date', 'date of admission'],
  phone_number: ['phone number', 'phone no', 'phone', 'mobile', 'contact']
}

function autoMatch(colName: string): string | null {
  const lower = colName.toLowerCase().trim().replace(/['']/g, "'").replace(/\s+/g, ' ')
  for (const [key, names] of Object.entries(AUTO_MATCH_PATTERNS)) {
    if (names.some((n) => lower.includes(n))) return key
  }
  return null
}

export default function ImportStudents({ sections, onComplete }: ImportStudentsProps) {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [fields, setFields] = useState<any[]>([])
  const [activeSheet, setActiveSheet] = useState('0')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAutoCreate, setShowAutoCreate] = useState(false)
  const [missingClasses, setMissingClasses] = useState<GroupInfo[]>([])
  const [duplicateCount, setDuplicateCount] = useState(0)

  useEffect(() => {
    if (!school) return
    window.api.fields.get(school.id).then(setFields)
  }, [school])

  // After sheets are loaded, detect groups by Class + Section columns
  useEffect(() => {
    if (sheets.length === 0 || !school) return
    ;(async () => {
      const updated = [...sheets]
      for (let i = 0; i < updated.length; i++) {
        const sh = updated[i]
        if (sh.groups) continue // already analyzed
        const classCol = findClassColumn(sh.columns)
        const sectionCol = findSectionColumn(sh.columns)
        if (!classCol) { updated[i] = { ...sh, groups: undefined }; continue }

        const groups = new Map<string, { className: string; sectionName: string; rows: any[] }>()
        for (const row of sh.rows) {
          const rawClass = String(row[classCol] || '').trim()
          const rawSection = sectionCol ? String(row[sectionCol] || 'A').trim() : 'A'
          const className = convertRomanToNumber(rawClass)
          const key = `${className}|${rawSection}`
          if (!groups.has(key)) groups.set(key, { className, sectionName: rawSection.toUpperCase(), rows: [] })
          groups.get(key)!.rows.push(row)
        }

        const allClasses = await window.api.classes.get(school.id)
        const groupInfo: GroupInfo[] = []
        let mergedRows: any[] = []

        for (const [, g] of groups) {
          const exists = allClasses.some((c: any) => c.name === g.className)
          groupInfo.push({ className: g.className, sectionName: g.sectionName, count: g.rows.length, exists })
          mergedRows = [...mergedRows, ...g.rows]
        }
        updated[i] = {
          ...sh,
          groups: groupInfo,
          rows: mergedRows,
          mapping: { ...sh.mapping, [classCol]: classCol },
          skippedColumns: [],
          newFieldColumns: {}
        }
      }
      setSheets(updated)
    })()
  }, [sheets.length])

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const Papa = (await import('papaparse')).default || await import('papaparse')
      const text = await file.text()
      Papa.parse(text, {
        header: true, skipEmptyLines: true,
        complete: (result: any) => {
          const cols = result.meta.fields || []
          const mapping: Record<string, string> = {}
          cols.forEach((c: string) => { const m = autoMatch(c); if (m) mapping[c] = m })
          setSheets([{ name: file.name.replace(/\.\w+$/, ''), columns: cols, rows: result.data as Record<string, any>[], mapping, skippedColumns: [], newFieldColumns: {} }])
        }
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheetList: SheetData[] = []
      for (const ws of workbook.worksheets) {
        const rows = ws.getSheetValues() as any[]
        const headerRow = (rows[1] || []) as any[]
        const cols = headerRow.slice(1).map((v: any) => String(v ?? '').trim()).filter(Boolean)
        if (cols.length === 0) continue
        const json: any[] = []
        for (let r = 2; r <= ws.rowCount; r++) {
          const row = ws.getRow(r)
          const rowObj: Record<string, any> = {}
          let hasValue = false
          cols.forEach((col, idx) => {
            const cellValue = row.getCell(idx + 1).value as any
            const normalized = typeof cellValue === 'object' && cellValue?.text ? cellValue.text : cellValue
            rowObj[col] = normalized ?? ''
            if (normalized !== null && normalized !== undefined && String(normalized).trim() !== '') hasValue = true
          })
          if (hasValue) json.push(rowObj)
        }
        if (json.length > 0) {
          const mapping: Record<string, string> = {}
          cols.forEach((c: string) => { const m = autoMatch(c); if (m) mapping[c] = m })
          sheetList.push({ name: ws.name, columns: cols, rows: json as Record<string, any>[], mapping, skippedColumns: [], newFieldColumns: {} })
        }
      }
      setSheets(sheetList)
    } else { message.error('Unsupported file format') }
    return false
  }

  const updateMapping = (sheetIdx: number, col: string, fieldKey: string) => {
    setSheets((prev) => {
      const next = [...prev]
      next[sheetIdx] = { ...next[sheetIdx], mapping: { ...next[sheetIdx].mapping, [col]: fieldKey } }
      return next
    })
  }

  const handleSkipColumn = (sheetIdx: number, col: string, skip: boolean) => {
    setSheets((prev) => {
      const next = [...prev]
      const s = next[sheetIdx]
      if (skip) {
        next[sheetIdx] = { ...s, skippedColumns: [...s.skippedColumns, col], mapping: { ...s.mapping, [col]: '' } }
      } else {
        next[sheetIdx] = { ...s, skippedColumns: s.skippedColumns.filter((c) => c !== col) }
      }
      return next
    })
  }

  const handleCreateField = async (sheetIdx: number, col: string, displayName: string) => {
    if (!school) return
    const key = `custom_${col.toLowerCase().replace(/\s+/g, '_')}`
    await window.api.fields.add({ school_id: school.id, field_key: key, display_name: displayName, field_type: 'text', is_searchable: 0 })
    const updatedFields = await window.api.fields.get(school.id)
    setFields(updatedFields)
    updateMapping(sheetIdx, col, key)
    setSheets((prev) => {
      const next = [...prev]
      next[sheetIdx] = { ...next[sheetIdx], newFieldColumns: { ...next[sheetIdx].newFieldColumns, [col]: displayName } }
      return next
    })
  }

  const checkAndCreateGroups = async () => {
    if (!school) return
    const missing: GroupInfo[] = []
    const updated = [...sheets]
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].groups) continue
      const allClasses = await window.api.classes.get(school.id)
      for (const g of updated[i].groups!) {
        if (!g.exists) missing.push(g)
        const classId = allClasses.find((c: any) => c.name === g.className)?.id
        if (classId) {
          const secs = await window.api.sections.getByClass(classId)
          const sec = secs.find((s: any) => s.name === g.sectionName)
          if (sec) g.sectionId = sec.id
        }
      }
    }
    if (missing.length > 0) {
      setMissingClasses(missing)
      setShowAutoCreate(true)
    } else {
      const dupes = await estimateDuplicates()
      setDuplicateCount(dupes)
      setShowConfirm(true)
    }
  }

  const estimateDuplicates = async () => {
    if (!school) return 0
    const existingStudents = await window.api.students.getAllBySchool(school.id)
    const existingByUid = new Set(existingStudents.map((s: any) => String(s.student_uid || '').trim().toLowerCase()).filter(Boolean))
    const existingByNameDob = new Set(
      existingStudents.map((s: any) => {
        const name = String(s.field_values?.full_name || s.full_name || '').trim().toLowerCase()
        const dob = String(s.field_values?.date_of_birth || '').trim()
        return name && dob ? `${name}|${dob}` : ''
      }).filter(Boolean)
    )
    const seenInFile = new Set<string>()
    let duplicates = 0
    for (const sh of sheets) {
      for (const row of sh.rows) {
        const uid = String(row.student_uid || row['Student ID'] || '').trim().toLowerCase()
        const name = String(row['Full Name'] || row.full_name || '').trim().toLowerCase()
        const dob = String(row['Date of Birth'] || row.date_of_birth || '').trim()
        const nameDobKey = name && dob ? `${name}|${dob}` : ''
        const fileDupKey = uid ? `uid:${uid}` : (nameDobKey ? `nd:${nameDobKey}` : '')
        const isDup =
          (uid && existingByUid.has(uid)) ||
          (nameDobKey && existingByNameDob.has(nameDobKey)) ||
          (fileDupKey && seenInFile.has(fileDupKey))
        if (isDup) {
          duplicates++
          continue
        }
        if (uid) existingByUid.add(uid)
        if (nameDobKey) existingByNameDob.add(nameDobKey)
        if (fileDupKey) seenInFile.add(fileDupKey)
      }
    }
    return duplicates
  }

  const handleAutoCreate = async () => {
    if (!school) return
    for (const g of missingClasses) {
      const allClasses = await window.api.classes.get(school.id)
      let classId = allClasses.find((c: any) => c.name === g.className)?.id
      if (!classId) classId = await window.api.classes.create(school.id, g.className)
      const secs = await window.api.sections.getByClass(classId)
      let sec = secs.find((s: any) => s.name === g.sectionName)
      if (!sec) {
        await window.api.sections.create(classId, g.sectionName, null)
        const us = await window.api.sections.getByClass(classId)
        sec = us.find((s: any) => s.name === g.sectionName)
      }
      if (sec) g.sectionId = sec.id
    }
    message.success(`Created ${missingClasses.length} missing class-sections`)
    setShowAutoCreate(false)
    const dupes = await estimateDuplicates()
    setDuplicateCount(dupes)
    setShowConfirm(true)
  }

  const buildSummary = () => {
    let total = 0
    let newFields = 0
    const byClass: Record<string, number> = {}
    for (const sh of sheets) {
      if (sh.groups) {
        for (const g of sh.groups) total += g.count
        for (const g of sh.groups) {
          const key = `${g.className} ${g.sectionName}`
          byClass[key] = (byClass[key] || 0) + g.count
        }
      } else {
        total += sh.rows.length
      }
      newFields += Object.keys(sh.newFieldColumns).length
    }
    return { total, byClass, newFields }
  }

  const handleImport = async () => {
    if (!school) return
    setLoading(true)
    let newFieldCount = 0
    try {
      const existingStudents = await window.api.students.getAllBySchool(school.id)
      const existingByUid = new Set(existingStudents.map((s: any) => String(s.student_uid || '').trim().toLowerCase()).filter(Boolean))
      const existingByNameDob = new Set(
        existingStudents.map((s: any) => {
          const name = String(s.field_values?.full_name || s.full_name || '').trim().toLowerCase()
          const dob = String(s.field_values?.date_of_birth || '').trim()
          return name && dob ? `${name}|${dob}` : ''
        }).filter(Boolean)
      )
      const seenInFile = new Set<string>()
      let skippedDuplicates = 0

      for (const sh of sheets) {
        if (sh.groups) {
          // Import grouped rows — each row goes to its group's section
          for (const row of sh.rows) {
            // Determine which group this row belongs to
            const classCol = findClassColumn(sh.columns)!
            const sectionCol = findSectionColumn(sh.columns) || classCol
            const rawClass = String(row[classCol] || '').trim()
            const rawSection = sectionCol !== classCol ? String(row[sectionCol] || 'A').trim().toUpperCase() : 'A'
            const className = convertRomanToNumber(rawClass)
            const group = sh.groups?.find((g) => g.className === className && g.sectionName === rawSection.toUpperCase())
            const sectionId = group?.sectionId
            if (!sectionId) continue

            const fieldValues = fields.map((f) => {
              const mappedCol = Object.entries(sh.mapping).find(([, v]) => v === f.field_key)?.[0]
              return { field_id: f.id, value: mappedCol ? row[mappedCol] || null : null }
            })

            const valueByKey = new Map<string, any>()
            for (const f of fields) {
              const val = fieldValues.find((fv: any) => fv.field_id === f.id)?.value
              valueByKey.set(f.field_key, val)
            }
            const uidCandidate = String(valueByKey.get('student_uid') || row.student_uid || row['Student ID'] || '').trim().toLowerCase()
            const nameCandidate = String(valueByKey.get('full_name') || '').trim().toLowerCase()
            const dobCandidate = String(valueByKey.get('date_of_birth') || '').trim()
            const nameDobKey = nameCandidate && dobCandidate ? `${nameCandidate}|${dobCandidate}` : ''
            const fileDupKey = uidCandidate ? `uid:${uidCandidate}` : (nameDobKey ? `nd:${nameDobKey}` : '')
            const isDup =
              (uidCandidate && existingByUid.has(uidCandidate)) ||
              (nameDobKey && existingByNameDob.has(nameDobKey)) ||
              (fileDupKey && seenInFile.has(fileDupKey))
            if (isDup) {
              skippedDuplicates++
              continue
            }
            if (uidCandidate) existingByUid.add(uidCandidate)
            if (nameDobKey) existingByNameDob.add(nameDobKey)
            if (fileDupKey) seenInFile.add(fileDupKey)

            await window.api.students.create({
              school_id: school.id, section_id: sectionId,
              enrollment_date: new Date().toISOString().split('T')[0],
              field_values: fieldValues
            })
          }
          newFieldCount += Object.keys(sh.newFieldColumns).length
        } else {
          if (!sh.sectionId) { message.error(`Sheet "${sh.name}" has no section selected`); continue }
          for (const row of sh.rows) {
            const fieldValues = fields.map((f) => {
              const mappedCol = Object.entries(sh.mapping).find(([, v]) => v === f.field_key)?.[0]
              return { field_id: f.id, value: mappedCol ? row[mappedCol] || null : null }
            })

            const valueByKey = new Map<string, any>()
            for (const f of fields) {
              const val = fieldValues.find((fv: any) => fv.field_id === f.id)?.value
              valueByKey.set(f.field_key, val)
            }
            const uidCandidate = String(valueByKey.get('student_uid') || row.student_uid || row['Student ID'] || '').trim().toLowerCase()
            const nameCandidate = String(valueByKey.get('full_name') || '').trim().toLowerCase()
            const dobCandidate = String(valueByKey.get('date_of_birth') || '').trim()
            const nameDobKey = nameCandidate && dobCandidate ? `${nameCandidate}|${dobCandidate}` : ''
            const fileDupKey = uidCandidate ? `uid:${uidCandidate}` : (nameDobKey ? `nd:${nameDobKey}` : '')
            const isDup =
              (uidCandidate && existingByUid.has(uidCandidate)) ||
              (nameDobKey && existingByNameDob.has(nameDobKey)) ||
              (fileDupKey && seenInFile.has(fileDupKey))
            if (isDup) {
              skippedDuplicates++
              continue
            }
            if (uidCandidate) existingByUid.add(uidCandidate)
            if (nameDobKey) existingByNameDob.add(nameDobKey)
            if (fileDupKey) seenInFile.add(fileDupKey)

            await window.api.students.create({
              school_id: school.id, section_id: sh.sectionId,
              enrollment_date: new Date().toISOString().split('T')[0],
              field_values: fieldValues
            })
          }
          newFieldCount += Object.keys(sh.newFieldColumns).length
        }
      }
      const { total, byClass } = buildSummary()
      const classList = Object.entries(byClass).map(([k, v]) => `${k} (${v})`).join(', ')
      const extra = newFieldCount > 0 ? ` ${newFieldCount} new custom field${newFieldCount > 1 ? 's' : ''} created.` : ''
      const dupMsg = skippedDuplicates > 0 ? ` Skipped ${skippedDuplicates} duplicate row${skippedDuplicates > 1 ? 's' : ''}.` : ''
      message.success(`Imported ${total - skippedDuplicates} students across ${Object.keys(byClass).length} class-sections: ${classList}.${extra}${dupMsg}`)
      setDuplicateCount(skippedDuplicates)
      setShowConfirm(false)
      onComplete()
    } catch { message.error(t('errors.generic')) }
    finally { setLoading(false) }
  }

  if (sheets.length === 0) {
    return (
      <div>
        <Upload beforeUpload={handleFile} accept=".csv,.xlsx,.xls" maxCount={1}>
          <Button icon={<UploadOutlined />}>Upload CSV or Excel File</Button>
        </Upload>
      </div>
    )
  }

  const summary = buildSummary()

  return (
    <div>
      <Upload beforeUpload={handleFile} accept=".csv,.xlsx,.xls" maxCount={1} showUploadList={false}>
        <Button icon={<UploadOutlined />} style={{ marginBottom: 16 }}>Upload Different File</Button>
      </Upload>

      {/* Group detection summary */}
      {sheets.some((sh) => sh.groups) && (
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 12 }}
          message="Class/Section column detected!"
          description={sheets.flatMap((sh) => (sh.groups || []).map((g) => (
            <Text key={`${g.className}-${g.sectionName}`} style={{ display: 'block' }}>
              {g.exists ? <CheckCircleOutlined style={{ color: '#0D9488' }} /> : <WarningOutlined style={{ color: '#F59E0B' }} />}
              {' '}{g.className} Section {g.sectionName} ({g.count} students)
            </Text>
          )))} />
      )}

      <Title level={5}>{sheets.length} sheet{sheets.length > 1 ? 's' : ''} loaded</Title>

      <Tabs activeKey={activeSheet} onChange={setActiveSheet}
        items={sheets.map((sh, i) => ({
          key: String(i),
          label: <span>{sh.name}{sh.groups ? <Tag color="blue" style={{ marginLeft: 4 }}>{sh.groups.length} groups</Tag> : null}</span>,
          children: (
            <div>
              {sh.groups ? (
                <Alert type="success" style={{ marginBottom: 12, borderRadius: 8 }}
                  message={`Found: ${sh.groups.map((g) => `${g.className} ${g.sectionName} (${g.count} students)`).join(', ')}`} />
              ) : (
                sh.sectionId === undefined && (
                  <Space style={{ marginBottom: 12 }}>
                    <Text strong>Map to section:</Text>
                    <Select style={{ width: 220 }} placeholder="Select section" value={sh.sectionId} onChange={(v) => {
                      setSheets((prev) => { const next = [...prev]; next[i] = { ...next[i], sectionId: v }; return next })
                    }} options={sections.map((s) => ({ label: `${s.class_name} ${s.name}`, value: s.id }))} />
                  </Space>
                )
              )}

              <Text strong style={{ display: 'block', marginBottom: 8 }}>Map columns to fields:</Text>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
                {sh.columns.map((col) => {
                  const matched = sh.mapping[col]
                  const skipped = sh.skippedColumns.includes(col)
                  return (
                    <Space key={col} style={{ opacity: skipped ? 0.5 : 1 }}>
                      <Text style={{ width: 160 }} strong>{col}</Text>
                      {matched && !skipped ? <Tag color="green">✓ {matched}</Tag> : skipped ? <Tag color="default">Skipped</Tag> : <Tag color="orange">⚠ Unmatched</Tag>}
                      <Select style={{ width: 200 }} placeholder="Map to field" allowClear
                        value={skipped ? undefined : (matched || undefined)}
                        onChange={(v) => {
                          if (v === '__skip__') handleSkipColumn(i, col, true)
                          else if (v === '__create__') {
                            const name = col.charAt(0).toUpperCase() + col.slice(1)
                            handleCreateField(i, col, name)
                          } else { handleSkipColumn(i, col, false); updateMapping(i, col, v) }
                        }}
                        options={[
                          ...fields.map((f) => ({ label: f.display_name, value: f.field_key })),
                          { label: '— Skip this column —', value: '__skip__' },
                          { label: `+ Create "${col}" as new field`, value: '__create__' }
                        ]} />
                    </Space>
                  )
                })}
              </Space>
              <Text type="secondary">{sh.rows.length} rows will be imported</Text>
              <Table dataSource={sh.rows.slice(0, 5)} columns={sh.columns.slice(0, 6).map((c) => ({ title: c, dataIndex: c, key: c, ellipsis: true, width: 120 }))}
                rowKey={(_, r) => String(r)} pagination={false} size="small" style={{ marginTop: 8 }} scroll={{ x: true }} />
              {sh.rows.length > 5 && <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Showing first 5 of {sh.rows.length} rows</Text>}
            </div>
          )
        }))}
      />

      <Button type="primary" onClick={checkAndCreateGroups} loading={loading} style={{ marginTop: 16 }}>
        Review & Import {summary.total} Students
      </Button>

      {/* Auto-create missing classes */}
      <Modal title="Missing Classes Detected" open={showAutoCreate} footer={null} onCancel={() => setShowAutoCreate(false)}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>These class-sections do not exist yet:</Text>
          {missingClasses.map((g) => (
            <Text key={`${g.className}-${g.sectionName}`} style={{ display: 'block' }}>
              <WarningOutlined style={{ color: '#F59E0B' }} /> {g.className} Section {g.sectionName} ({g.count} students)
            </Text>
          ))}
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" onClick={handleAutoCreate}>Create automatically and proceed</Button>
            <Button onClick={() => setShowAutoCreate(false)}>Cancel — I'll create them manually</Button>
          </Space>
        </Space>
      </Modal>

      {/* Final confirmation */}
      <Modal title="Confirm Import" open={showConfirm} onOk={handleImport} onCancel={() => setShowConfirm(false)} confirmLoading={loading} okText={`Import ${summary.total} Students`} width={600}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>Total: {summary.total} students</Text>
          {duplicateCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${duplicateCount} potential duplicate row${duplicateCount > 1 ? 's' : ''} will be skipped during import`}
            />
          )}
          <Text>Class-section breakdown:</Text>
          {Object.entries(summary.byClass).map(([k, v]) => (
            <Text key={k} style={{ display: 'block', marginLeft: 12 }}>{k}: {v} students</Text>
          ))}
          {sheets.some((sh) => sh.skippedColumns.length > 0) && (
            <><Text strong style={{ marginTop: 8 }}>Skipped columns:</Text>
            {sheets.flatMap((sh) => sh.skippedColumns.map((c) => (
              <Text key={`${sh.name}-${c}`} style={{ display: 'block', marginLeft: 12 }}>{c}</Text>
            )))}</>
          )}
          {sheets.some((sh) => Object.keys(sh.newFieldColumns).length > 0) && (
            <><Text strong style={{ marginTop: 8 }}>New fields to be created:</Text>
            {sheets.flatMap((sh) => Object.entries(sh.newFieldColumns).map(([k, v]) => (
              <Text key={k} style={{ display: 'block', marginLeft: 12 }}>{k} → {v}</Text>
            )))}</>
          )}
        </Space>
      </Modal>
    </div>
  )
}
