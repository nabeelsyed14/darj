import { useState, useEffect } from 'react'
import { Select, Input, Button, Table, Space, Typography, message, Modal, Form, DatePicker, Card, Tag, Row, Col, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'

const { Title, Text } = Typography

export default function MarksEntry() {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [exams, setExams] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<number | undefined>(undefined)
  const [selectedSection, setSelectedSection] = useState<number | undefined>(undefined)
  const [students, setStudents] = useState<any[]>([])
  const [marks, setMarks] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCreateExam, setShowCreateExam] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [createExamForm] = Form.useForm()
  const [subjectForm] = Form.useForm()
  const [activeExam, setActiveExam] = useState<number | undefined>(undefined)
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (school) { window.api.classes.get(school.id).then(setClasses); loadExams() } }, [school])

  useEffect(() => {
    if (!selectedClass || !school) return
    window.api.marks.getSubjects(selectedClass).then(setSubjects)
    window.api.sections.getByClass(selectedClass).then(setSections)
    setSelectedSection(undefined)
  }, [selectedClass, school])

  useEffect(() => {
    if (!selectedSection || !activeExam) return
    loadMarks()
  }, [selectedSection, activeExam])

  const loadExams = async () => {
    if (!school) return
    const all = await window.api.marks.getExams(school.id, school.academic_year)
    setExams(all)
  }

  const loadMarks = async () => {
    if (!selectedSection || !activeExam) return
    setLoading(true)
    try {
      const sts = await window.api.students.getBySection(selectedSection)
      setStudents(sts)
      const records = await window.api.marks.getByExam(activeExam)
      const mm: Record<string, number | null> = {}
      for (const r of records) mm[`${r.student_id}-${r.subject_id}`] = r.marks_obtained
      setMarks(mm)
    } catch { message.error(t('errors.generic')) }
    finally { setLoading(false) }
  }

  const handleCreateExam = async () => {
    if (!school) return
    const v = await createExamForm.validateFields()
    const allExams = await window.api.marks.getExams(school.id, school.academic_year)
    const currentTotal = allExams.reduce((s: number, e: any) => s + (e.weight_percentage || 0), 0)
    const newWeight = Number(v.weight) || 100
    if (currentTotal + newWeight > 100) {
      message.error(`Total exam weightage cannot exceed 100%. Current: ${currentTotal}%, Attempted: ${newWeight}%`)
      return
    }
    await window.api.marks.createExam(
      school.id, school.academic_year, v.name,
      v.date?.format('YYYY-MM-DD') || null,
      'major', newWeight
    )
    message.success('Exam created')
    setShowCreateExam(false); createExamForm.resetFields(); loadExams()
  }

  const handleDeleteExam = async (examId: number) => {
    await window.api.marks.deleteExam(examId)
    message.success('Exam deleted')
    loadExams()
  }

  const handleSaveMarks = async () => {
    if (!activeExam) return
    setSaving(true)
    try {
      for (const st of students) {
        for (const sub of subjects) {
          const key = `${st.id}-${sub.id}`
          const obtained = marks[key]
          if (obtained === undefined) continue
          await window.api.marks.upsert({
            student_id: st.id, subject_id: sub.id, exam_id: activeExam,
            marks_obtained: obtained, max_marks: 100, passing_marks: sub.passing_marks
          })
        }
      }
      message.success(t('common.success'))
    } catch { message.error(t('errors.generic')) }
    finally { setSaving(false) }
  }

  const handleCompleteExam = async () => {
    if (!activeExam) return
    await window.api.marks.markExamCompleted(activeExam, new Date().toISOString().split('T')[0])
    message.success('Exam marked as completed')
    setActiveExam(undefined); setSelectedSection(undefined); setEditing(false)
    loadExams()
  }

  const handleAddSubject = async () => {
    if (!selectedClass || !school) return
    const v = await subjectForm.validateFields()
    await window.api.marks.createSubject(school.id, selectedClass, v.name, v.passing_marks || null)
    subjectForm.resetFields()
    window.api.marks.getSubjects(selectedClass).then(setSubjects)
    message.success(t('common.success'))
  }

  const handleDeleteSubject = async (id: number) => {
    await window.api.marks.deleteSubject(id)
    window.api.marks.getSubjects(selectedClass!).then(setSubjects)
    message.success(t('common.success'))
  }

  const isCompleted = (e: any) => e.is_completed === 1
  const upcomingExams = exams.filter((e) => !isCompleted(e))
  const completedExams = exams.filter((e) => isCompleted(e))

  const renderExamCard = (e: any, color: string) => (
    <Card key={e.id} size="small" hoverable onClick={() => { setActiveExam(e.id); setEditing(isCompleted(e)) }}
      style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>{e.name}</Text>
        <Tag color="blue" style={{ marginLeft: 8 }}>{e.weight_percentage}%</Tag>
      </div>
      {e.exam_date && <Text type="secondary">{e.exam_date}{!isCompleted(e) && ' (tentative)'}</Text>}
    </Card>
  )

  return (
    <div>
      <Title level={4}>{t('sidebar.marks')}</Title>

      <Space style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateExam(true)}>Create New Exam</Button>
      </Space>

      {upcomingExams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>Upcoming Exams</Title>
          <Row gutter={[16, 16]}>
            {upcomingExams.map((e) => <Col key={e.id} xs={24} sm={12} md={8}>{renderExamCard(e, '#2A6372')}</Col>)}
          </Row>
          <Space style={{ marginTop: 8 }}>
            {upcomingExams.map((e) => (
              <Popconfirm key={e.id} title="Delete this exam and all its marks?" onConfirm={() => handleDeleteExam(e.id)}>
                <Button size="small" danger icon={<DeleteOutlined />}>Delete {e.name}</Button>
              </Popconfirm>
            ))}
          </Space>
        </div>
      )}

      {completedExams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>Completed Exams</Title>
          <Row gutter={[16, 16]}>
            {completedExams.map((e) => <Col key={e.id} xs={24} sm={12} md={8}>{renderExamCard(e, '#0D9488')}</Col>)}
          </Row>
        </div>
      )}

      {activeExam && (
        <Card title="Enter Marks" style={{ marginBottom: 16, borderTop: '3px solid #2A6372' }}>
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <Select placeholder="Select Class" style={{ width: 160 }} value={selectedClass}
              onChange={(v) => { setSelectedClass(v); setSelectedSection(undefined) }}
              options={classes.map((c) => ({ label: c.name, value: c.id }))} />
            {selectedClass && (
              <>
                <Select placeholder="Select Section" style={{ width: 120 }} value={selectedSection}
                  onChange={setSelectedSection}
                  options={sections.map((s: any) => ({ label: s.name, value: s.id }))} />
                <Button onClick={() => setShowSubjectModal(true)}>Manage Subjects</Button>
              </>
            )}
          </Space>

          {selectedSection && (
            <>
              <Space style={{ marginBottom: 12 }}>
                {!isCompleted(exams.find((e) => e.id === activeExam)) ? (
                  <>
                    <Button type="primary" onClick={handleSaveMarks} loading={saving}>Save Marks</Button>
                    <Button style={{ background: '#0D9488', borderColor: '#0D9488', color: '#fff' }} onClick={handleCompleteExam}>Mark as Completed</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setEditing(!editing)}>{editing ? 'Read Only' : 'Edit Marks'}</Button>
                    {editing && <Button type="primary" onClick={handleSaveMarks} loading={saving}>Save Changes</Button>}
                  </>
                )}
              </Space>
              <Table dataSource={students} columns={[
                { title: t('students.studentId'), dataIndex: 'student_uid', width: 130 },
                { title: t('fields.full_name'), key: 'fn', render: (_: any, r: any) => r.field_values?.full_name || '-' },
                ...subjects.map((sub) => ({
                  title: sub.name, key: sub.id, width: 100,
                  render: (_: any, student: any) => {
                    const key = `${student.id}-${sub.id}`
                    if (!editing && isCompleted(exams.find((e) => e.id === activeExam))) {
                      const val = marks[key]
                      const pass = sub.passing_marks ? (Number(val) >= sub.passing_marks) : null
                      return <Text style={{ color: pass === false ? '#EF4444' : pass === true ? '#0D9488' : undefined }}>{val ?? '-'}</Text>
                    }
                    return editing || !isCompleted(exams.find((e) => e.id === activeExam)) ? (
                      <Input size="small" type="number" value={marks[key] ?? ''}
                        onChange={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); setMarks((p) => ({ ...p, [key]: v })) }}
                        style={{ width: 70 }} />
                    ) : <Text>{marks[key] ?? '-'}</Text>
                  }
                }))
              ]} rowKey="id" loading={loading} pagination={false} size="small" scroll={{ x: true }} />
            </>
          )}
        </Card>
      )}

      {/* Create Exam Modal */}
      <Modal title="Create New Exam" open={showCreateExam} onCancel={() => setShowCreateExam(false)} footer={null}>
        <Form form={createExamForm} layout="vertical" onFinish={handleCreateExam} initialValues={{ weight: 100 }}>
          <Form.Item name="name" label="Exam Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="weight" label="Weightage %"><Input type="number" /></Form.Item>
          <Form.Item name="date" label="Exam Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Total current weightage: {exams.reduce((s: number, e: any) => s + (e.weight_percentage || 0), 0)}%</Text>
          <Button type="primary" htmlType="submit">Create Exam</Button>
        </Form>
      </Modal>

      {/* Manage Subjects Modal */}
      <Modal title={`Manage Subjects`} open={showSubjectModal} onCancel={() => setShowSubjectModal(false)} footer={null}>
        <Table dataSource={subjects} rowKey="id" size="small" pagination={false} columns={[
          { title: 'Subject', dataIndex: 'name' },
          { title: 'Passing Marks', dataIndex: 'passing_marks', render: (v: any) => v ?? '—' },
          { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => handleDeleteSubject(r.id)}>Delete</Button> }
        ]} />
        <Form form={subjectForm} layout="inline" onFinish={handleAddSubject} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="passing_marks" label="Passing"><Input type="number" style={{ width: 80 }} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Add</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
