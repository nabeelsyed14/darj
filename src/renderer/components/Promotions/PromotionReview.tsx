import { useState, useEffect } from 'react'
import { Table, Select, Button, Space, Typography, message, Popconfirm, Modal, Tag, Card, Row, Col, Tabs, Input } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'

const { Title, Text } = Typography

export default function PromotionReview() {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<number | undefined>(undefined)
  const [students, setStudents] = useState<any[]>([])
  const [results, setResults] = useState<Record<number, { status: string; reason?: string }>>({})
  const [marksMap, setMarksMap] = useState<Record<number, { summary: string; weightedAvg: number }>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [exceptionalStudent, setExceptionalStudent] = useState<any>(null)
  const [exceptionalReason, setExceptionalReason] = useState('')
  const [threshold, setThreshold] = useState(33)

  useEffect(() => { if (school) window.api.classes.get(school.id).then(setClasses) }, [school])

  useEffect(() => {
    if (!selectedClass) return
    loadStudents()
  }, [selectedClass])

  const loadStudents = async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      const sections = await window.api.sections.getByClass(selectedClass)
      let all: any[] = []
      const marksData: Record<number, { summary: string; weightedAvg: number }> = {}
      for (const sec of sections) {
        const s = await window.api.students.getBySection(sec.id)
        for (const st of s) {
          const marks = await window.api.marks.getByStudent(st.id)
          const examMap = new Map<string, { weight: number; marks: number[] }>()
          for (const m of marks) {
            const key = m.exam_name
            if (!examMap.has(key)) examMap.set(key, { weight: m.weight_percentage || 100, marks: [] })
            examMap.get(key)!.marks.push(m.marks_obtained || 0)
          }
          let weightedTotal = 0, totalWeight2 = 0
          for (const [, examData] of examMap) {
            const d = examData!
            const avg = d.marks.length > 0 ? Math.round(d.marks.reduce((a: number, b: number) => a + b, 0) / d.marks.length) : 0
            weightedTotal += avg * d.weight
            totalWeight2 += d.weight
          }
          const finalWeightedAvg = totalWeight2 > 0 ? Math.round(weightedTotal / totalWeight2) : 0

          const subjects = (marks.map((m: any) => m.subject_name as string)).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
          const subjectSummaries = subjects.map((sub: string) => {
            const sm = marks.filter((m: any) => m.subject_name === sub)
            const avg = sm.length > 0 ? Math.round(sm.reduce((a: number, m: any) => a + (m.marks_obtained || 0), 0) / sm.length) : 0
            const pass = sm.length > 0 && !sm.some((m: any) => m.is_pass === 0)
            return `${sub}: ${avg}% ${pass ? '✓' : '✗'}`
          })
          marksData[st.id] = { summary: subjectSummaries.join(', ') || 'No marks', weightedAvg: finalWeightedAvg }
          all.push({ ...st, section_id: sec.id, section_name: sec.name })
        }
      }
      setStudents(all)
      setMarksMap(marksData)
    } catch { message.error(t('errors.generic')) }
    finally { setLoading(false) }
  }

  const handleAutoPromote = async () => {
    const newResults: Record<number, { status: string; reason?: string }> = {}
    for (const st of students) {
      const md = marksMap[st.id]
      if (!md || md.summary === 'No marks') { newResults[st.id] = { status: 'pending' }; continue }
      const passes = md.weightedAvg >= threshold
      newResults[st.id] = { status: passes ? 'promoted' : 'failed' }
    }
    setResults(newResults)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const st of students) {
        const r = results[st.id]
        if (!r || r.status === 'pending') continue
        const sections = await window.api.sections.getByClass(selectedClass!)
        await window.api.promotions.promote({
          student_id: st.id, from_section_id: st.section_id,
          to_section_id: r.status === 'promoted' ? sections[0]?.id : null,
          academic_year: school?.academic_year, status: r.status,
          reason: r.reason || null
        })
      }
      message.success(t('common.success'))
      setShowConfirm(false); setShowPreview(false)
      loadStudents(); setResults({})
    } catch { message.error(t('errors.generic')) }
    finally { setSaving(false) }
  }

  const promotedCount = Object.values(results).filter((r) => r.status === 'promoted' && !r.reason).length
  const failedCount = Object.values(results).filter((r) => r.status === 'failed').length
  const pendingCount = Object.values(results).filter((r) => r.status === 'pending').length
  const exceptionalCount = Object.values(results).filter((r) => r.status === 'promoted' && !!r.reason).length

  const columns = [
    { title: t('fields.full_name'), key: 'fn', render: (_: any, r: any) => r.field_values?.full_name || '-' },
    { title: t('students.studentId'), dataIndex: 'student_uid', width: 140, render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{v}</span> },
    { title: 'Section', dataIndex: 'section_name', width: 60 },
    { title: 'Marks Summary', key: 'ms', render: (_: any, r: any) => {
      const summary = marksMap[r.id]?.summary || '...'
      return (
        <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {summary.split(', ').map((s: string, idx: number) => {
            const isPass = s.includes('✓')
            return (
              <span key={idx} style={{ display: 'block', color: isPass ? '#0D9488' : s.includes('✗') ? '#EF4444' : undefined }}>
                {s}
              </span>
            )
          })}
          {marksMap[r.id]?.weightedAvg > 0 && <span style={{ display: 'block', color: '#2A6372', fontWeight: 600 }}>W.Avg: {marksMap[r.id]?.weightedAvg}%</span>}
        </Text>
      )
    }},
    { title: 'Result', key: 'result', width: 140, render: (_: any, r: any) => {
      const rr = results[r.id]
      if (!rr) return <Tag>Pending</Tag>
      if (rr.status === 'promoted' && rr.reason) return <Tag color="purple" icon={<ExclamationCircleOutlined />}>Exceptional</Tag>
      if (rr.status === 'promoted') return <Tag color="green" icon={<CheckCircleOutlined />}>Promoted</Tag>
      if (rr.status === 'failed') return <Tag color="red" icon={<CloseCircleOutlined />}>Failed</Tag>
      if (rr.status === 'no_marks') return <Tag color="orange">No Marks</Tag>
      return <Tag>Pending</Tag>
    }},
    { title: 'Action', key: 'action', width: 280, render: (_: any, r: any) => (
      <Space>
        <Popconfirm title="Promote?" onConfirm={() => setResults((p) => ({ ...p, [r.id]: { status: 'promoted' } }))}>
          <Button size="small" type="primary">Promote</Button>
        </Popconfirm>
        <Popconfirm title="Fail?" onConfirm={() => setResults((p) => ({ ...p, [r.id]: { status: 'failed' } }))}>
          <Button size="small" danger>Fail</Button>
        </Popconfirm>
        <Button size="small" style={{ background: '#C79E45', borderColor: '#C79E45', color: '#fff' }}
          onClick={() => { setExceptionalStudent(r); setExceptionalReason('') }}>Exceptional</Button>
      </Space>
    )}
  ]

  return (
    <div>
      <Title level={4}>{t('sidebar.promotions')}</Title>

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Select placeholder="Select Class" style={{ width: 160 }} value={selectedClass} onChange={(v) => { setSelectedClass(v); setResults({}) }}
          options={classes.map((c) => ({ label: c.name, value: c.id }))} />
        <Text strong style={{ color: '#2A6372' }}>Passing Threshold:</Text>
        <input type="number" min="1" max="100" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ width: 60, fontWeight: 700, fontSize: 15, border: '2px solid #2A6372', textAlign: 'center', borderRadius: 8, padding: '4px 8px', color: '#2A6372' }} />
        <Text strong style={{ color: '#2A6372' }}>%</Text>
        <Button icon={<ThunderboltOutlined />} type="primary" onClick={handleAutoPromote} disabled={!selectedClass}>
          Auto-Promote
        </Button>
        {Object.keys(results).length > 0 && (
          <><Button style={{ background: '#2A6372', borderColor: '#2A6372', color: '#fff' }} onClick={() => setShowPreview(true)}>Preview</Button>
          <Button style={{ background: '#0D9488', borderColor: '#0D9488', color: '#fff' }} onClick={() => setShowConfirm(true)}>Save</Button></>
        )}
      </Space>

      {Object.keys(results).length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small" style={{ background: '#F0FDF4', borderTop: '3px solid #0D9488' }}><Title level={3} style={{ margin: 0 }}>{promotedCount}</Title><Text>Promoted</Text></Card></Col>
          <Col span={6}><Card size="small" style={{ background: '#FEF2F2', borderTop: '3px solid #EF4444' }}><Title level={3} style={{ margin: 0 }}>{failedCount}</Title><Text>Failed</Text></Card></Col>
          <Col span={6}><Card size="small" style={{ background: '#FCF4DF', borderTop: '3px solid #C79E45' }}><Title level={3} style={{ margin: 0 }}>{exceptionalCount}</Title><Text>Exceptional</Text></Card></Col>
          <Col span={6}><Card size="small" style={{ background: '#FFF7ED', borderTop: '3px solid #F97316' }}><Title level={3} style={{ margin: 0 }}>{pendingCount}</Title><Text>Pending</Text></Card></Col>
        </Row>
      )}

      <Table dataSource={students} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="small" />

      <Modal title="Exceptional Promotion" open={!!exceptionalStudent} onCancel={() => setExceptionalStudent(null)}
        onOk={() => { setResults((p) => ({ ...p, [exceptionalStudent!.id]: { status: 'promoted', reason: exceptionalReason } })); setExceptionalStudent(null) }}
        okText="Confirm">
        <Text>{exceptionalStudent?.student_uid} — {exceptionalStudent?.field_values?.full_name}</Text>
        <Input.TextArea placeholder="Reason for exceptional promotion (required)" value={exceptionalReason} onChange={(e) => setExceptionalReason(e.target.value)}
          rows={3} style={{ marginTop: 12 }} />
      </Modal>

      <Modal title="Preview" open={showPreview} onCancel={() => setShowPreview(false)} footer={null} width={800}>
        <Tabs items={[
          { key: 'promoted', label: `Promoted (${promotedCount})`, children: <PreviewTable students={students} results={results} filter="promoted" /> },
          { key: 'exceptional', label: `Exceptional (${exceptionalCount})`, children: <PreviewTable students={students} results={results} filter="exceptional" /> },
          { key: 'failed', label: `Failed (${failedCount})`, children: <PreviewTable students={students} results={results} filter="failed" /> },
          { key: 'pending', label: `Pending (${pendingCount})`, children: <PreviewTable students={students} results={results} filter="pending" /> }
        ]} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
          <Button type="primary" onClick={() => { setShowPreview(false); setShowConfirm(true) }}>Confirm and Save</Button>
        </div>
      </Modal>

      <Modal title="Confirm" open={showConfirm} onOk={handleSave} onCancel={() => setShowConfirm(false)} confirmLoading={saving} okText="Save">
        <Space direction="vertical">
          <Text strong>{promotedCount} promoted</Text>
          <Text strong style={{ color: '#EF4444' }}>{failedCount} failed</Text>
          <Text strong style={{ color: '#F59E0B' }}>{pendingCount} pending</Text>
        </Space>
      </Modal>
    </div>
  )
}

function PreviewTable({ students, results, filter }: any) {
  const filtered = students.filter((s: any) => {
    const r = results[s.id]
    if (!r) return false
    if (filter === 'exceptional') return r.status === 'promoted' && r.reason
    if (filter === 'promoted') return r.status === 'promoted' && !r.reason
    if (filter === 'failed') return r.status === 'failed'
    if (filter === 'pending') return r.status === 'pending'
    return false
  })
  return <Table dataSource={filtered} rowKey="id" size="small" pagination={false} columns={[
    { title: 'ID', dataIndex: 'student_uid', width: 130 },
    { title: 'Name', key: 'n', render: (_: any, r: any) => r.field_values?.full_name || '-' },
    { title: 'Sec', dataIndex: 'section_name', width: 60 },
    { title: 'Reason', key: 'reason', render: (_: any, r: any) => results[r.id]?.reason || '-' }
  ]} />
}
