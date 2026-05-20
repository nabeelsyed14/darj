import { useState, useEffect } from 'react'
import { Table, Button, Input, Select, Space, Modal, message, Typography, Tag, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, UserDeleteOutlined, SwapOutlined, ImportOutlined, TeamOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSchoolStore } from '../../store/schoolStore'
import StudentForm from './StudentForm'
import StudentProfile from './StudentProfile'
import MoveStudent from './MoveStudent'
import ImportStudents from './ImportStudents'

const { Title } = Typography

interface Student {
  id: number
  student_uid: string
  section_id: number
  status: string
  enrollment_date: string
  photo?: string
  field_values: Record<string, any>
}

interface Section {
  id: number
  name: string
  class_name: string
}

export default function StudentList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { school } = useSchoolStore()
  const [students, setStudents] = useState<Student[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [totalStudentsCount, setTotalStudentsCount] = useState(0)
  const [activeStudentsCount, setActiveStudentsCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSection, setFilterSection] = useState<number | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [movingStudent, setMovingStudent] = useState<Student | null>(null)

  useEffect(() => {
    loadSections()
  }, [school])

  useEffect(() => {
    loadStudents()
  }, [filterSection, searchQuery])

  useEffect(() => {
    loadSummaryCounts()
  }, [school])

  const loadSections = async () => {
    if (!school) return
    try {
      const allSections = await window.api.sections.getAll(school.id)
      setSections(allSections)
    } catch (e: any) {
      console.error('loadSections error:', e)
      if (window.api?.app?.logError) window.api.app.logError('loadSections: ' + e?.message)
    }
  }

  const loadStudents = async () => {
    if (!school) return
    setLoading(true)
    try {
      let result: Student[] = []
      if (searchQuery.trim()) {
        result = await window.api.students.search(searchQuery.trim(), school.id)
      } else if (filterSection) {
        result = await window.api.students.getBySection(filterSection)
      } else {
        // M3 Fix: Replaced N+1 loop with a single query
        result = await window.api.students.getAllBySchool(school.id)
      }
      setStudents(result)
      loadSummaryCounts(result)
    } catch (e: any) {
      console.error('loadStudents error:', e)
      if (window.api?.app?.logError) window.api.app.logError('loadStudents: ' + e?.message)
      message.error(e?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  // M4 Fix: Take pre-loaded students to avoid another N+1
  const loadSummaryCounts = async (preloaded?: Student[]) => {
    if (!school) return
    try {
      let all: Student[] = preloaded || []
      if (!preloaded) {
        all = await window.api.students.getAllBySchool(school.id)
      }
      setTotalStudentsCount(all.length)
      setActiveStudentsCount(all.filter((s: Student) => s.status === 'active').length)
    } catch (e: any) {
      console.error('loadSummaryCounts error:', e)
    }
  }

  const handleDelete = async (student: Student) => {
    await window.api.students.delete(student.id)
    message.success(t('common.success'))
    loadStudents()
    loadSummaryCounts()
  }

  const columns = [
    {
      title: '',
      key: 'avatar',
      width: 48,
      render: (_: any, record: Student) => (
        record.photo ? (
          <img src={record.photo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2A6372, #3C7D8E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
        )
      )
    },
    {
      title: t('students.studentId'),
      dataIndex: 'student_uid',
      key: 'student_uid',
      width: 150
    },
    {
      title: t('fields.full_name'),
      key: 'full_name',
      render: (_: any, record: any) => record.field_values?.full_name || record.full_name || '-'
    },
    {
      title: t('fields.gender'),
      key: 'gender',
      width: 80,
      render: (_: any, record: any) => record.field_values?.gender || record.gender || '-'
    },
    {
      title: t('fields.pen_number'),
      key: 'pen_number',
      width: 120,
      render: (_: any, record: any) => record.field_values?.pen_number || record.pen_number || '-'
    },
    {
      title: t('students.status'),
      key: 'status',
      width: 100,
      render: (_: any, record: Student) => (
        <Tag color={record.status === 'active' ? 'green' : 'red'}>
          {record.status === 'active' ? t('students.active') : t('students.withdrawn')}
        </Tag>
      )
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: any, record: Student) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewingStudent(record)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingStudent(record); setShowForm(true) }} />
          <Button size="small" icon={<SwapOutlined />} onClick={() => setMovingStudent(record)} />
          <Popconfirm title="Delete this student permanently?" onConfirm={() => handleDelete(record)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Button size="small" danger icon={<UserDeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="dashboard-header">
        <Title level={4} style={{ margin: 0 }}>{t('students.title')}</Title>
        <div className="subtitle">{school?.name || ''}{school?.name && school?.academic_year ? ' — ' : ''}{school?.academic_year || ''}</div>
      </div>

      <div className="stats-row">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/students')}>
          <div className="stat-value">{totalStudentsCount}</div>
          <div className="stat-label">{t('students.title')}</div>
          <TeamOutlined className="stat-icon" />
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setFilterSection(undefined); loadStudents() }}>
          <div className="stat-value">{activeStudentsCount}</div>
          <div className="stat-label">{t('students.active')}</div>
          <TeamOutlined className="stat-icon" />
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/classes')}>
          <div className="stat-value">{sections.length}</div>
          <div className="stat-label">{t('sidebar.classes')}</div>
          <ApartmentOutlined className="stat-icon" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ImportOutlined />} onClick={() => setShowImport(true)}>
            {t('students.addStudent')} / Import
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingStudent(null); setShowForm(true) }}>
            {t('students.addStudent')}
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('students.searchPlaceholder')}
          style={{ width: 250 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
        <Select
          placeholder={t('students.filterBySection')}
          style={{ width: 200 }}
          value={filterSection}
          onChange={(v) => setFilterSection(v)}
          allowClear
          options={sections.map((s) => ({ label: `${s.class_name} ${s.name}`, value: s.id }))}
        />
      </Space>

      <Table
        dataSource={students}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t('students.noStudents') }}
      />

      <Modal
        title={editingStudent ? t('students.editStudent') : t('students.addStudent')}
        open={showForm}
        onCancel={() => { setShowForm(false); setEditingStudent(null) }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <StudentForm
          student={editingStudent}
          sections={sections}
          onComplete={() => { setShowForm(false); setEditingStudent(null); loadStudents(); loadSummaryCounts() }}
        />
      </Modal>

      <Modal
        title={t('students.profile')}
        open={!!viewingStudent}
        onCancel={() => setViewingStudent(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {viewingStudent && <StudentProfile student={viewingStudent} onViewAnalytics={(id) => { setViewingStudent(null); navigate('/analytics', { state: { studentId: id } }) }} />}
      </Modal>

      <Modal
        title={t('students.moveStudent')}
        open={!!movingStudent}
        onCancel={() => setMovingStudent(null)}
        footer={null}
        width={400}
        destroyOnClose
      >
        {movingStudent && (
          <MoveStudent
            student={movingStudent}
            sections={sections}
            onComplete={() => { setMovingStudent(null); loadStudents(); loadSummaryCounts() }}
          />
        )}
      </Modal>

      <Modal
        title="Import Students"
        open={showImport}
        onCancel={() => setShowImport(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ImportStudents
          sections={sections}
          onComplete={() => { setShowImport(false); loadStudents(); loadSummaryCounts() }}
        />
      </Modal>
    </div>
  )
}

