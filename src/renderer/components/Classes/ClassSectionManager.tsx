import { useState, useEffect } from 'react'
import { Button, Input, Space, Typography, message, Popconfirm, Collapse, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import ClassSelector from './ClassSelector'

const { Title, Text } = Typography

interface ClassData {
  id: number
  name: string
  display_order: number
  sections?: SectionData[]
}

interface SectionData {
  id: number
  name: string
  class_teacher_name: string | null
  student_count: number
}

export default function ClassSectionManager() {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [classes, setClasses] = useState<ClassData[]>([])
  const [_loading, setLoading] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [editingClass, setEditingClass] = useState<number | null>(null)
  const [editingClassName, setEditingClassName] = useState('')
  const [newSectionClassId, setNewSectionClassId] = useState<number | null>(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionTeacher, setNewSectionTeacher] = useState('')

  useEffect(() => {
    loadClasses()
  }, [])

  const loadClasses = async () => {
    if (!school) return
    setLoading(true)
    try {
      const classList = await window.api.classes.get(school.id)
      const withSections = await Promise.all(
        classList.map(async (cls: ClassData) => {
          const sections = await window.api.sections.getByClass(cls.id)
          return { ...cls, sections }
        })
      )
      setClasses(withSections)
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddClass = async () => {
    if (!school || !newClassName.trim()) return
    await window.api.classes.create(school.id, newClassName.trim())
    setNewClassName('')
    message.success(t('common.success'))
    loadClasses()
  }

  const handleUpdateClass = async (id: number) => {
    if (!editingClassName.trim()) return
    await window.api.classes.update(id, editingClassName.trim())
    setEditingClass(null)
    message.success(t('common.success'))
    loadClasses()
  }

  const handleDeleteClass = async (id: number) => {
    await window.api.classes.delete(id)
    message.success(t('common.success'))
    loadClasses()
  }

  const handleAddSection = async (classId: number) => {
    if (!newSectionName.trim()) return
    await window.api.sections.create(classId, newSectionName.trim(), newSectionTeacher.trim() || null)
    setNewSectionClassId(null)
    setNewSectionName('')
    setNewSectionTeacher('')
    message.success(t('common.success'))
    loadClasses()
  }

  const handleDeleteSection = async (id: number) => {
    await window.api.sections.delete(id)
    message.success(t('common.success'))
    loadClasses()
  }

  return (
    <div>
      <Title level={4}>{t('sidebar.classes')}</Title>

      <Space style={{ marginBottom: 16 }}>
        <ClassSelector value={newClassName} onChange={setNewClassName} placeholder={t('classes.newClassPlaceholder')} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClass}>
          {t('wizard.step3.addClass')}
        </Button>
      </Space>

      <Collapse
        items={classes.map((cls) => ({
          key: cls.id,
          label: (
            <Space>
              {editingClass === cls.id ? (
                <>
                  <Input
                    value={editingClassName}
                    onChange={(e) => setEditingClassName(e.target.value)}
                    onPressEnter={() => handleUpdateClass(cls.id)}
                    style={{ width: 150 }}
                    autoFocus
                  />
                  <Button size="small" icon={<SaveOutlined />} onClick={() => handleUpdateClass(cls.id)} />
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingClass(null)} />
                </>
              ) : (
                <>
                  <Text strong>{cls.name}</Text>
                  <Tag color="blue">
                    {t('classes.sectionCount', { count: cls.sections?.length || 0 })}
                  </Tag>
                  <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingClass(cls.id); setEditingClassName(cls.name) }} />
                  <Popconfirm title={t('classes.deleteClassConfirm')} onConfirm={() => handleDeleteClass(cls.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              )}
            </Space>
          ),
          children: (
            <div>
              {(cls.sections || []).map((sec: SectionData) => (
                <Space key={sec.id} style={{ display: 'flex', marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Text strong>{t('classes.sectionLabel', { name: sec.name })}</Text>
                    {sec.class_teacher_name && (
                      <Text type="secondary">
                        <UserOutlined style={{ marginRight: 4 }} />
                        {sec.class_teacher_name}
                      </Text>
                    )}
                    <Tag>{t('classes.studentCount', { count: sec.student_count })}</Tag>
                  </Space>
                  <Popconfirm title={t('classes.deleteSectionConfirm')} onConfirm={() => handleDeleteSection(sec.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ))}

              {newSectionClassId === cls.id ? (
                <Space style={{ marginTop: 8 }}>
                  <Input
                    placeholder={t('wizard.step3.sectionName')}
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    style={{ width: 80 }}
                    autoFocus
                  />
                  <Input
                    placeholder={t('wizard.step3.classTeacher')}
                    value={newSectionTeacher}
                    onChange={(e) => setNewSectionTeacher(e.target.value)}
                    style={{ width: 150 }}
                  />
                  <Button size="small" type="primary" onClick={() => handleAddSection(cls.id)}>
                    {t('common.save')}
                  </Button>
                  <Button size="small" onClick={() => { setNewSectionClassId(null); setNewSectionName(''); setNewSectionTeacher('') }}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              ) : (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setNewSectionClassId(cls.id)}
                  style={{ marginTop: 8 }}
                >
                  {t('wizard.step3.addSection')}
                </Button>
              )}
            </div>
          )
        }))}
      />
    </div>
  )
}
