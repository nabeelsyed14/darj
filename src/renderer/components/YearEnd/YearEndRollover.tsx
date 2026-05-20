import { useState, useEffect } from 'react'
import { Card, Button, Typography, message, Table, Space, Modal, Tag, Alert, Select, Input, DatePicker } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function YearEndRollover() {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [loading, setLoading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [showRollover, setShowRollover] = useState(false)
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [classSummary, setClassSummary] = useState<any[]>([])
  const [finalClass, setFinalClass] = useState<string | null>(null)
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [availableFields, setAvailableFields] = useState<any[]>([])
  const [selectedExtraFields, setSelectedExtraFields] = useState<string[]>([])

  // Status management state
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusStudent, setStatusStudent] = useState<any>(null)
  const [newStatus, setNewStatus] = useState('active')
  const [statusReason, setStatusReason] = useState('')
  const [statusDate, setStatusDate] = useState(dayjs())
  const [statusSearch, setStatusSearch] = useState('')

  useEffect(() => { if (!school) return; loadAll() }, [school])

  const loadAll = async () => {
    if (!school) return
    setLoading(true)
    try {
      const classList = await window.api.classes.get(school.id)
      setAllClasses(classList)

      const fieldDefs = await window.api.fields.get(school.id)
      setAvailableFields(fieldDefs.filter((f: any) => f.field_key !== 'full_name'))

      const fc = await window.api.settings.get(school.id, 'final_class')
      const finalClassName = fc || (classList.length > 0 ? classList[classList.length - 1].name : null)
      setFinalClass(finalClassName)

      const secs = await window.api.sections.getAll(school.id)
      let allSt: any[] = []
      for (const sec of secs) {
        const sts = await window.api.students.getAllBySection(sec.id)
        allSt = [...allSt, ...sts.map((s: any) => ({ ...s, class_name: sec.class_name, section_name: sec.name }))]
      }
      setAllStudents(allSt)

      const withSections = await Promise.all(classList.map(async (cls: any) => {
        const sections = await window.api.sections.getByClass(cls.id)
        return { ...cls, sections }
      }))

      const promotionsForYear = await window.api.promotions.getByYear(school.academic_year)
      const promotionByStudentId = new Map<number, any>()
      for (const p of promotionsForYear) {
        if (!promotionByStudentId.has(p.student_id)) {
          promotionByStudentId.set(p.student_id, p)
        }
      }

      const summary = await Promise.all(withSections.map(async (cls: any) => {
        let total = 0, pending = 0, promoted = 0, failed = 0
        for (const sec of cls.sections) {
          // Use active rolls for rollover readiness, consistent with Classes & Sections counts.
          const students = await window.api.students.getBySection(sec.id)
          total += students.length
          const studentResults = students.map((s: any) => promotionByStudentId.get(s.id))
          pending += studentResults.filter((r: any) => !r).length
          promoted += studentResults.filter((r: any) => r?.status === 'promoted').length
          failed += studentResults.filter((r: any) => r?.status === 'failed').length
        }
        const promotionsDone = promoted + failed
        const ready = total > 0 && promotionsDone >= total
        return { name: cls.name, total, promotionsDone, ready, pending, promoted, failed }
      }))
      setClassSummary(summary)
    } catch (e: any) { console.error('loadAll error:', e); message.error(t('errors.generic')) }
    finally { setLoading(false) }
  }

  const calculateNextYear = (currentYear: string): string => {
    if (!currentYear) return ''
    const raw = String(currentYear).trim()

    const shortMatch = raw.match(/^(\d{4})-(\d{2})$/)
    if (shortMatch) {
      const startYear = parseInt(shortMatch[1])
      return `${startYear + 1}-${String(startYear + 2).slice(-2)}`
    }

    const longMatch = raw.match(/^(\d{4})-(\d{4})$/)
    if (longMatch) {
      const startYear = parseInt(longMatch[1])
      return `${startYear + 1}-${startYear + 2}`
    }

    const plainMatch = raw.match(/^(\d{4})$/)
    if (plainMatch) {
      return String(parseInt(plainMatch[1]) + 1)
    }

    message.error(`Cannot parse academic year: "${raw}". Expected format: 2026-27`)
    return ''
  }

  const handleArchive = async () => {
    if (!school) return

    const latestSchool = await window.api.app.getSchool()
    if (!latestSchool?.academic_year || latestSchool.academic_year.trim() === '') {
      message.error('Academic year is not set. Please configure the academic year in Settings first.')
      return
    }

    const currentYear = latestSchool.academic_year
    const nextYear = calculateNextYear(currentYear)
    if (!nextYear) {
      message.error(`Could not calculate next academic year. Current academic year is: "${currentYear}"`)
      return
    }

    setArchiving(true)
    try {
      // Ensure all saved promotions are materialized into student status/section
      // before archiving and year switch.
      await window.api.promotions.finalizeRollover(school.id, currentYear, finalClass)

      await window.api.archives.archive(school.id, currentYear)

      const promotionsForYear = await window.api.promotions.getByYear(currentYear)
      const promotionByStudentId = new Map<number, any>()
      for (const p of promotionsForYear) {
        if (!promotionByStudentId.has(p.student_id)) {
          promotionByStudentId.set(p.student_id, p)
        }
      }

      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const now = dayjs().format('DD/MM/YYYY HH:mm')
      const allSheetData: any[] = []
      const summaryData: any[] = []

      const styleHeader = (ws: any, row: number, cols: number) => {
        for (let c = 1; c <= cols; c++) {
          const cell = ws.getRow(row).getCell(c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } }
          cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1E3A5F' } }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        }
        ws.getRow(row).height = 22
      }

      const classSections = await Promise.all(allClasses.map(async (cls: any) => ({
        cls,
        secs: await window.api.sections.getByClass(cls.id)
      })))

      for (const { cls, secs } of classSections) {
        const classMarks = await window.api.marks.getByClass(cls.id, currentYear)
        const marksByStudentId = new Map<number, any[]>()
        for (const m of classMarks) {
          if (!marksByStudentId.has(m.student_id)) marksByStudentId.set(m.student_id, [])
          marksByStudentId.get(m.student_id)!.push(m)
        }

        for (const sec of secs) {
          const students = await window.api.students.getAllBySection(sec.id)
          if (students.length === 0) continue

          const studentData: any[] = students.map((s: any) => {
            const marks = marksByStudentId.get(s.id) || []
            const examMap = new Map<string, { weight: number; percentages: number[] }>()
            for (const m of marks) {
              if (!examMap.has(m.exam_name)) examMap.set(m.exam_name, { weight: m.weight_percentage || 100, percentages: [] })
              const max = Number(m.max_marks || 0)
              const obtained = Number(m.marks_obtained || 0)
              const pct = max > 0 ? (obtained / max) * 100 : 0
              examMap.get(m.exam_name)!.percentages.push(pct)
            }
            let wT = 0, tW = 0
            for (const [, d] of examMap) {
              const examPct = d.percentages.length > 0 ? (d.percentages.reduce((a: number, b: number) => a + b, 0) / d.percentages.length) : 0
              wT += examPct * d.weight
              tW += d.weight
            }
            const pct = tW > 0 ? Math.round(wT / tW) : 0
            const promo = promotionByStudentId.get(s.id)
            let result = 'Pending'
            if (promo?.status === 'promoted' && promo?.reason) result = 'Exceptional'
            else if (promo?.status === 'promoted') result = 'Promoted'
            else if (promo?.status === 'failed') result = 'Failed'
            const statusLabel =
              s.status === 'active' ? 'Active'
              : s.status === 'withdrawn' ? 'Withdrawn'
              : s.status === 'on_leave' ? 'On Leave'
              : s.status === 'transferred' ? 'Transferred'
              : s.status === 'passed_out' ? 'Passed Out'
              : s.status
            return { student: s, pct, result, rawResult: result, status: statusLabel }
          })

          studentData.sort((a: any, b: any) => b.pct - a.pct)
          for (let i = 0; i < studentData.length; i++) studentData[i].rank = i + 1

          allSheetData.push({ cls, sec, studentData, sheetName: `${cls.name} ${sec.name}`.substring(0, 31) })
          summaryData.push({
            class: `${cls.name} ${sec.name}`,
            total: students.length,
            topperName: studentData[0]?.student?.field_values?.full_name || '-',
            topperPct: studentData[0]?.pct || 0
          })
        }
      }

      if (summaryData.length > 0) {
        const sws = wb.addWorksheet('Summary')
        const sh = ['Class-Section', 'Total', 'Class Topper', 'Topper %']
        sh.forEach((h, i) => { sws.getCell(1, i + 1).value = h })
        styleHeader(sws, 1, sh.length)
        summaryData.forEach((d, i) => {
          const r = i + 2
          sws.getCell(r, 1).value = d.class
          sws.getCell(r, 2).value = d.total
          sws.getCell(r, 3).value = d.topperName
          sws.getCell(r, 4).value = d.topperPct
        })
        sws.columns = [{ width: 20 }, { width: 8 }, { width: 25 }, { width: 12 }]
      }

      for (const { studentData, sheetName } of allSheetData) {
        const ws = wb.addWorksheet(sheetName)
        const extraCols = selectedExtraFields.length
        const cols = 5 + extraCols

        ws.mergeCells(1, 1, 1, cols)
        const r1 = ws.getCell('A1')
        r1.value = school.name
        r1.font = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FF8B0000' } }
        r1.alignment = { horizontal: 'center', vertical: 'middle' }
        ws.getRow(1).height = 35

        ws.mergeCells(2, 1, 2, cols)
        const r2 = ws.getCell('A2')
        r2.value = [school.address, school.principal_name].filter(Boolean).join(' | ')
        r2.font = { name: 'Calibri', size: 11, color: { argb: 'FF555555' } }
        r2.alignment = { horizontal: 'center' }

        ws.mergeCells(4, 1, 4, cols)
        const r4 = ws.getCell('A4')
        r4.value = `Year End Report: ${currentYear}`
        r4.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FF1E3A5F' } }
        r4.alignment = { horizontal: 'center' }

        ws.mergeCells(5, 1, 5, cols)
        const r5 = ws.getCell('A5')
        r5.value = `Generated: ${dayjs().format('DD/MM/YYYY')}`
        r5.font = { name: 'Calibri', size: 10, color: { argb: 'FF555555' } }
        r5.alignment = { horizontal: 'center' }

        const headers = ['Full Name', 'Result', 'Percentage', 'Class Rank', 'Status', ...selectedExtraFields.map((key) => {
          const def = availableFields.find((f: any) => f.field_key === key)
          return def?.display_name || key
        })]
        headers.forEach((h, i) => { ws.getCell(7, i + 1).value = h })
        styleHeader(ws, 7, cols)

        for (let i = 0; i < studentData.length; i++) {
          const d = studentData[i]
          const row = 8 + i
          ws.getCell(row, 1).value = d.student.field_values?.full_name || d.student.student_uid
          ws.getCell(row, 2).value = d.rawResult
          ws.getCell(row, 3).value = d.pct > 0 ? `${d.pct}%` : '-'
          ws.getCell(row, 4).value = d.rank
          ws.getCell(row, 5).value = d.status
          selectedExtraFields.forEach((key, idx) => {
            ws.getCell(row, 6 + idx).value = d.student.field_values?.[key] ?? ''
          })

          for (let c = 1; c <= cols; c++) {
            const cell = ws.getRow(row).getCell(c)
            if (d.rawResult === 'Failed') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } }
              cell.font = { color: { argb: 'FF8B0000' } }
            } else if (d.rank === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
              cell.font = { bold: true }
            } else if (d.rank === 2) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
            } else if (d.rank === 3) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E0' } }
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFEEF2FF' } }
            }
            cell.font = { ...cell.font, name: 'Calibri', size: 10 }
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          }
        }

        const fRow = 8 + studentData.length
        ws.mergeCells(fRow, 1, fRow, cols)
        const fCell = ws.getCell(fRow, 1)
        fCell.value = `${studentData.length} students | Generated by Darj | ${now}`
        fCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF888888' } }

        ws.columns = [
          { width: 25 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 },
          ...selectedExtraFields.map(() => ({ width: 20 }))
        ]
      }

      // Update school year FIRST (before Excel, so rollover is saved even if Excel fails)
      await window.api.schools.update({
        id: school.id, name: school.name, address: school.address || '',
        principal_name: school.principal_name || '', academic_year: nextYear,
        uid_prefix: school.uid_prefix || 'SCH'
      })
      const updatedSchool = await window.api.app.getSchool()
      if (updatedSchool) useSchoolStore.getState().setSchool(updatedSchool)
      message.success(`Rollover complete. ${currentYear} has been archived.`)

      // Generate Excel as separate step — errors here don't block the rollover
      try {
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `Darj_YearEnd_${currentYear}_${dateStr}.xlsx`
        const buffer = await wb.xlsx.writeBuffer()
        const bytes = Array.from(new Uint8Array(buffer as ArrayBuffer))
        const saveResult = await window.api.app.saveToDesktop(filename, bytes)
        if (saveResult.success) {
          Modal.success({
            title: 'Academic Year Successfully Closed',
            content: `Year ${currentYear} has been archived and rollover to ${nextYear} is complete.\n\nReport saved to:\n${saveResult.path || filename}`
          })
        } else {
          Modal.warning({
            title: 'Rollover Completed, Report Not Saved',
            content: `Year rollover was successful, but report save was skipped or failed: ${saveResult.error || 'unknown error'}`
          })
        }
      } catch (excelErr: any) {
        Modal.warning({
          title: 'Rollover Completed, Report Generation Failed',
          content: `Year rollover was successful, but Excel report could not be generated: ${excelErr.message}`
        })
      }

      setShowRollover(false)
      setShowFieldPicker(false)
      setSelectedExtraFields([])
      loadAll()
    } catch (e: any) {
      message.error(`Rollover failed: ${e?.message || t('errors.generic')}`)
    } finally {
      setArchiving(false)
    }
  }

  const handleChangeStatus = async () => {
    if (!statusStudent || !statusReason.trim()) { message.error('Reason is required'); return }
    try {
      await window.api.students.changeStatus(
        statusStudent.id, statusStudent.status, newStatus,
        statusReason.trim(), statusDate.format('YYYY-MM-DD')
      )
      const label = newStatus === 'active' ? 'Active' : newStatus === 'withdrawn' ? 'Withdrawn' : newStatus === 'on_leave' ? 'On Leave' : 'Transferred'
      message.success(`Status updated to ${label}`)
      setShowStatusModal(false)
      setStatusReason('')
      loadAll()
    } catch {
      message.error('Failed to update status')
    }
  }

  const getNextClassName = (name: string) => {
    if (!name.startsWith('Class ')) return null
    const num = parseInt(name.replace('Class ', ''))
    if (isNaN(num)) return null
    const next = `Class ${num + 1}`
    return allClasses.some((c) => c.name === next) ? next : null
  }

  const createSingleClass = async (className: string) => {
    if (!school) return
    const num = parseInt(className.replace('Class ', ''))
    if (isNaN(num)) return
    const nextName = `Class ${num + 1}`
    const classId = await window.api.classes.create(school.id, nextName)
    await window.api.sections.create(classId, 'A', null)
    message.success(`Created ${nextName}`)
    loadAll()
  }

  const summaryColumns = [
    { title: 'Class', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Total Students', dataIndex: 'total' },
    { title: 'Promotions Done', dataIndex: 'promotionsDone' },
    {
      title: 'Ready to Roll Over', render: (_: any, r: any) => {
        if (r.ready) return <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
        if (r.pending > 0) return <Tag color="orange" icon={<CloseCircleOutlined />}>No ({r.pending} pending)</Tag>
        return <Tag color="orange" icon={<CloseCircleOutlined />}>No</Tag>
      }
    },
    {
      title: '', render: (_: any, r: any) => {
        const next = getNextClassName(r.name)
        if (!next && r.name !== finalClass && r.total > 0) return (
          <Button size="small" type="link" onClick={() => createSingleClass(r.name)}>
            Create Class {parseInt(r.name.replace('Class ', '')) + 1}
          </Button>
        )
        return null
      }
    }
  ]

  const statusColumns = [
    { title: 'Name', key: 'name', render: (_: any, r: any) => r.field_values?.full_name || r.student_uid },
    { title: 'Class', dataIndex: 'class_name' },
    { title: 'Section', dataIndex: 'section_name' },
    {
      title: 'Status', dataIndex: 'status', render: (v: string) => {
        const color = v === 'active' ? 'green' : v === 'withdrawn' ? 'default' : 'orange'
        const label = v === 'active' ? 'Active' : v === 'withdrawn' ? 'Withdrawn' : v === 'on_leave' ? 'On Leave' : v === 'transferred' ? 'Transferred' : v
        return <Tag color={color}>{label}</Tag>
      }
    },
    { title: 'Action', render: (_: any, r: any) => (
      <Button size="small" onClick={() => { setStatusStudent(r); setNewStatus(r.status); setStatusReason(''); setShowStatusModal(true) }}>Change Status</Button>
    ) }
  ]

  const nextYear = school ? calculateNextYear(school.academic_year) : ''

  return (
    <div>
      <Title level={4}>{t('sidebar.yearEnd')}</Title>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="About Year-End Rollover"
        description="Promoted students move to the next class. Students promoted from the final class are marked as Passed Out and removed from active rolls. Failed students stay in their current class. Withdrawn students are not carried over."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Card title="Manage Student Status" style={{ marginBottom: 24, borderTop: '3px solid #2A6372' }}>
        <Input.Search
          placeholder="Search by name or student ID"
          value={statusSearch}
          onChange={(e) => setStatusSearch(e.target.value)}
          style={{ marginBottom: 12, width: 300 }}
          allowClear
        />
        <Table
          dataSource={allStudents.filter((s: any) => {
            const q = statusSearch.toLowerCase()
            return !q || (s.field_values?.full_name || '').toLowerCase().includes(q) || (s.student_uid || '').toLowerCase().includes(q)
          })}
          columns={statusColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      <Card title="Roll Over to New Academic Year" style={{ marginBottom: 24, borderTop: '3px solid #C79E45' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {!school?.academic_year || school.academic_year.trim() === '' ? (
            <Alert type="error" showIcon message="Academic Year Not Set" description="Please configure the academic year in Settings before performing rollover." style={{ marginBottom: 16 }} />
          ) : (
            <Text type="secondary">Current year: <Text strong>{school?.academic_year}</Text>  |  Next year: <Text strong>{nextYear}</Text>  |  Final class: <Text strong>{finalClass || 'Not set'}</Text></Text>
          )}
          <Table dataSource={classSummary} columns={summaryColumns} rowKey="name" loading={loading} pagination={false} size="small" />
          <Button
            type="primary"
            style={{ background: '#C79E45', borderColor: '#C79E45', marginTop: 12 }}
            onClick={() => {
              if (!school?.academic_year || school.academic_year.trim() === '') {
                message.error('Academic year is not set. Please configure the academic year in Settings first.')
                return
              }
              setShowRollover(true)
            }}
            loading={archiving}
          >
            Archive & Roll Over
          </Button>
        </Space>
      </Card>

      <Modal
        title="Confirm Rollover"
        open={showRollover}
        onOk={() => { setShowRollover(false); setShowFieldPicker(true) }}
        onCancel={() => setShowRollover(false)}
        okText="Confirm Rollover"
      >
        <Text>This will close {school?.academic_year} and begin {nextYear}. All promoted students will move to the next class. Are you sure?</Text>
      </Modal>

      <Modal
        title="Year End Excel Fields"
        open={showFieldPicker}
        onOk={handleArchive}
        onCancel={() => setShowFieldPicker(false)}
        confirmLoading={archiving}
        okText="Run Rollover"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select additional fields to include in the year-end Excel report (predefined fields are already included).</Text>
          <Select
            mode="multiple"
            placeholder="Choose extra fields"
            value={selectedExtraFields}
            onChange={setSelectedExtraFields}
            style={{ width: '100%' }}
            options={availableFields.map((f: any) => ({ label: f.display_name, value: f.field_key }))}
          />
        </Space>
      </Modal>

      <Modal title="Change Student Status" open={showStatusModal} onCancel={() => setShowStatusModal(false)} onOk={handleChangeStatus} okText="Save">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>{statusStudent?.field_values?.full_name} ({statusStudent?.student_uid})</Text>
          <Select
            value={newStatus}
            onChange={setNewStatus}
            style={{ width: '100%' }}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Withdrawn', value: 'withdrawn' },
              { label: 'On Leave', value: 'on_leave' },
              { label: 'Transferred', value: 'transferred' }
            ]}
          />
          <Input.TextArea placeholder="Reason for status change (required)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={3} />
          <DatePicker value={statusDate} onChange={(d) => setStatusDate(d || dayjs())} style={{ width: '100%' }} />
        </Space>
      </Modal>
    </div>
  )
}
