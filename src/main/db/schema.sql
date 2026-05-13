-- Schools
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  principal_name TEXT,
  academic_year TEXT NOT NULL,
  uid_prefix TEXT DEFAULT 'SCH',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Modules (attendance, marks, promotions)
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  module_key TEXT NOT NULL CHECK(module_key IN ('attendance', 'marks', 'promotions')),
  is_enabled INTEGER DEFAULT 1,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  UNIQUE(school_id, module_key)
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Sections
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  class_teacher_name TEXT,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Student Fields (dynamic schema)
CREATE TABLE IF NOT EXISTS student_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK(field_type IN ('text', 'date', 'number', 'select')),
  is_searchable INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  UNIQUE(school_id, field_key)
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  section_id INTEGER NOT NULL,
  student_uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'withdrawn', 'promoted', 'failed', 'on_leave', 'transferred', 'passed_out')),
  enrollment_date DATE,
  photo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

-- Student Field Values (EAV pattern)
CREATE TABLE IF NOT EXISTS student_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  value_text TEXT,
  value_date DATE,
  value_number REAL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES student_fields(id),
  UNIQUE(student_id, field_id)
);

-- Users (login)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  recovery_key_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  section_id INTEGER NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (section_id) REFERENCES sections(id),
  UNIQUE(student_id, date)
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  passing_marks REAL,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE(school_id, class_id, name)
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  name TEXT NOT NULL,
  exam_date DATE,
  exam_type TEXT DEFAULT 'minor' CHECK(exam_type IN ('major', 'minor')),
  weight_percentage REAL DEFAULT 100,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Migrations: add exam_type and weight_percentage if missing
ALTER TABLE exams ADD COLUMN exam_type TEXT DEFAULT 'minor';
ALTER TABLE exams ADD COLUMN weight_percentage REAL DEFAULT 100;
ALTER TABLE exams ADD COLUMN class_id INTEGER REFERENCES classes(id);
ALTER TABLE exams ADD COLUMN is_completed INTEGER DEFAULT 0;

-- Migrations: add photo column to students
ALTER TABLE students ADD COLUMN photo TEXT;

-- Status change history
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  effective_date DATE NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Marks
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  exam_id INTEGER NOT NULL,
  marks_obtained REAL,
  max_marks REAL NOT NULL,
  passing_marks REAL,
  is_pass INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE(student_id, subject_id, exam_id)
);

-- Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  from_section_id INTEGER NOT NULL,
  to_section_id INTEGER,
  academic_year TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('promoted', 'failed')),
  promotion_date DATE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (from_section_id) REFERENCES sections(id),
  FOREIGN KEY (to_section_id) REFERENCES sections(id)
);

-- Migrations: add reason column to promotions
ALTER TABLE promotions ADD COLUMN reason TEXT;

-- Archives (year-end snapshots)
CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_blob TEXT NOT NULL,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  UNIQUE(school_id, academic_year)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  FOREIGN KEY (school_id) REFERENCES schools(id),
  UNIQUE(school_id, key)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_student_field_values_student ON student_field_values(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance(section_id, date);
CREATE INDEX IF NOT EXISTS idx_marks_student_exam ON marks(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);
