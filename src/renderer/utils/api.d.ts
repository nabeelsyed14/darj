export interface Api {
  app: {
    isSetupComplete: () => Promise<boolean>
    getSchool: () => Promise<any>
    backup: () => Promise<{ success: boolean; path?: string }>
    restore: () => Promise<{ success: boolean }>
    saveToDesktop: (filename: string, data: number[]) => Promise<{ success: boolean; path?: string; error?: string }>
    logError: (msg: string) => Promise<void>
    isMaximized: () => Promise<boolean>
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    onMaximizeChange: (cb: (maximized: boolean) => void) => void
  }
  schools: {
    create: (data: any) => Promise<number>
    update: (data: any) => Promise<void>
  }
  auth: {
    create: (schoolId: number, password: string) => Promise<{ recoveryKey: string }>
    verifyLogin: (password: string) => Promise<boolean>
    resetPassword: (recoveryKey: string, newPassword: string) => Promise<boolean>
    changePassword: (current: string, newPass: string) => Promise<boolean>
  }
  students: {
    create: (data: any) => Promise<number>
    get: (id: number) => Promise<any>
    getBySection: (sectionId: number) => Promise<any[]>
    getAllBySection: (sectionId: number) => Promise<any[]>
    update: (id: number, data: any) => Promise<void>
    withdraw: (id: number) => Promise<void>
    delete: (id: number) => Promise<void>
    move: (id: number, sectionId: number) => Promise<void>
    search: (query: string, schoolId: number) => Promise<any[]>
    changeStatus: (id: number, oldStatus: string, newStatus: string, reason: string, effectiveDate: string) => Promise<void>
    getStatusHistory: (id: number) => Promise<any[]>
    updatePhoto: (id: number, photo: string) => Promise<void>
    getAllBySchool: (schoolId: number) => Promise<any[]>
  }
  fields: {
    defaults: () => Promise<any[]>
    create: (schoolId: number, fields: any[]) => Promise<void>
    get: (schoolId: number) => Promise<any[]>
    add: (data: any) => Promise<void>
    update: (id: number, data: any) => Promise<void>
    remove: (id: number) => Promise<void>
    reorder: (ids: number[]) => Promise<void>
  }
  classes: {
    create: (schoolId: number, name: string) => Promise<number>
    get: (schoolId: number) => Promise<any[]>
    update: (id: number, name: string) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  sections: {
    create: (classId: number, name: string, teacher: string | null) => Promise<number>
    getByClass: (classId: number) => Promise<any[]>
    getAll: (schoolId: number) => Promise<any[]>
    update: (id: number, data: any) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  modules: {
    enable: (schoolId: number, keys: string[]) => Promise<void>
    get: (schoolId: number) => Promise<any[]>
    toggle: (schoolId: number, key: string, enabled: boolean) => Promise<void>
  }
  settings: {
    get: (schoolId: number, key: string) => Promise<string | null>
    set: (schoolId: number, key: string, value: string) => Promise<void>
    getAll: (schoolId: number) => Promise<any[]>
  }
  attendance: {
    mark: (data: any) => Promise<void>
    markBulk: (records: any[]) => Promise<void>
    getByDate: (sectionId: number, date: string) => Promise<any[]>
    getByStudent: (studentId: number, start: string, end: string) => Promise<any[]>
    getSummary: (sectionId: number, start: string, end: string) => Promise<any[]>
  }
  marks: {
    createSubject: (schoolId: number, classId: number, name: string, passingMarks: number | null) => Promise<number>
    getSubjects: (classId: number) => Promise<any[]>
    deleteSubject: (id: number) => Promise<void>
    createExam: (schoolId: number, year: string, name: string, date: string | null, examType: string, weight: number, classId?: number, maxMarks?: number) => Promise<number>
    getExams: (schoolId: number, year: string) => Promise<any[]>
    getExamsByClass: (classId: number, year: string) => Promise<any[]>
    markExamCompleted: (examId: number, date: string) => Promise<void>
    deleteExam: (id: number) => Promise<void>
    upsert: (data: any) => Promise<void>
    getByExam: (examId: number) => Promise<any[]>
    getByStudent: (studentId: number) => Promise<any[]>
    getClassMarks: (classId: number, examId: number) => Promise<any[]>
    getBySchool: (schoolId: number, year: string) => Promise<any[]>
    getByClass: (classId: number, year: string) => Promise<any[]>
  }
  promotions: {
    promote: (data: any) => Promise<void>
    getByYear: (year: string) => Promise<any[]>
    getByStudent: (studentId: number) => Promise<any[]>
    finalizeRollover: (schoolId: number, year: string, finalClassName: string | null) => Promise<void>
  }
  archives: {
    archive: (schoolId: number, year: string) => Promise<void>
    get: (schoolId: number) => Promise<any[]>
    getData: (schoolId: number, year: string) => Promise<any[]>
    delete: (id: number) => Promise<void>
    importData: (schoolId: number, year: string, students: any[]) => Promise<void>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
