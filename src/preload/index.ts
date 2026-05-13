import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  app: {
    isSetupComplete: () => ipcRenderer.invoke('app:isSetupComplete'),
    getSchool: () => ipcRenderer.invoke('app:getSchool'),
    backup: () => ipcRenderer.invoke('app:backup'),
    restore: () => ipcRenderer.invoke('app:restore'),
    saveToDesktop: (filename: string, data: number[]) => ipcRenderer.invoke('app:saveToDesktop', filename, data),
    logError: (msg: string) => ipcRenderer.invoke('app:logError', msg),
    isMaximized: () => ipcRenderer.invoke('app:isMaximized'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    maximize: () => ipcRenderer.invoke('app:maximize'),
    close: () => ipcRenderer.invoke('app:close'),
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      ipcRenderer.on('maximize-changed', (_e: any, val: boolean) => cb(val))
    }
  },
  schools: {
    create: (data: any) => ipcRenderer.invoke('schools:create', data),
    update: (data: any) => ipcRenderer.invoke('schools:update', data)
  },
  auth: {
    create: (schoolId: number, password: string) => ipcRenderer.invoke('auth:create', schoolId, password),
    verifyLogin: (password: string) => ipcRenderer.invoke('auth:verifyLogin', password),
    resetPassword: (recoveryKey: string, newPassword: string) => ipcRenderer.invoke('auth:resetPassword', recoveryKey, newPassword),
    changePassword: (current: string, newPass: string) => ipcRenderer.invoke('auth:changePassword', current, newPass)
  },
  students: {
    create: (data: any) => ipcRenderer.invoke('students:create', data),
    get: (id: number) => ipcRenderer.invoke('students:get', id),
    getBySection: (sectionId: number) => ipcRenderer.invoke('students:getBySection', sectionId),
    getAllBySection: (sectionId: number) => ipcRenderer.invoke('students:getAllBySection', sectionId),
    update: (id: number, data: any) => ipcRenderer.invoke('students:update', id, data),
    withdraw: (id: number) => ipcRenderer.invoke('students:withdraw', id),
    move: (id: number, sectionId: number) => ipcRenderer.invoke('students:move', id, sectionId),
    updatePhoto: (id: number, photo: string) => ipcRenderer.invoke('students:updatePhoto', id, photo),
    changeStatus: (id: number, oldStatus: string, newStatus: string, reason: string, effectiveDate: string) => ipcRenderer.invoke('students:changeStatus', id, oldStatus, newStatus, reason, effectiveDate),
    getStatusHistory: (id: number) => ipcRenderer.invoke('students:getStatusHistory', id),
    search: (query: string, schoolId: number) => ipcRenderer.invoke('students:search', query, schoolId)
  },
  fields: {
    defaults: () => ipcRenderer.invoke('fields:defaults'),
    create: (schoolId: number, fields: any[]) => ipcRenderer.invoke('fields:create', schoolId, fields),
    get: (schoolId: number) => ipcRenderer.invoke('fields:get', schoolId),
    add: (data: any) => ipcRenderer.invoke('fields:add', data),
    update: (id: number, data: any) => ipcRenderer.invoke('fields:update', id, data),
    remove: (id: number) => ipcRenderer.invoke('fields:remove', id),
    reorder: (ids: number[]) => ipcRenderer.invoke('fields:reorder', ids)
  },
  classes: {
    create: (schoolId: number, name: string) => ipcRenderer.invoke('classes:create', schoolId, name),
    get: (schoolId: number) => ipcRenderer.invoke('classes:get', schoolId),
    update: (id: number, name: string) => ipcRenderer.invoke('classes:update', id, name),
    delete: (id: number) => ipcRenderer.invoke('classes:delete', id)
  },
  sections: {
    create: (classId: number, name: string, teacher: string | null) => ipcRenderer.invoke('sections:create', classId, name, teacher),
    getByClass: (classId: number) => ipcRenderer.invoke('sections:getByClass', classId),
    getAll: (schoolId: number) => ipcRenderer.invoke('sections:getAll', schoolId),
    update: (id: number, data: any) => ipcRenderer.invoke('sections:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('sections:delete', id)
  },
  modules: {
    enable: (schoolId: number, keys: string[]) => ipcRenderer.invoke('modules:enable', schoolId, keys),
    get: (schoolId: number) => ipcRenderer.invoke('modules:get', schoolId),
    toggle: (schoolId: number, key: string, enabled: boolean) => ipcRenderer.invoke('modules:toggle', schoolId, key, enabled)
  },
  settings: {
    get: (schoolId: number, key: string) => ipcRenderer.invoke('settings:get', schoolId, key),
    set: (schoolId: number, key: string, value: string) => ipcRenderer.invoke('settings:set', schoolId, key, value),
    getAll: (schoolId: number) => ipcRenderer.invoke('settings:getAll', schoolId)
  },
  attendance: {
    mark: (data: any) => ipcRenderer.invoke('attendance:mark', data),
    markBulk: (records: any[]) => ipcRenderer.invoke('attendance:markBulk', records),
    getByDate: (sectionId: number, date: string) => ipcRenderer.invoke('attendance:getByDate', sectionId, date),
    getByStudent: (studentId: number, start: string, end: string) => ipcRenderer.invoke('attendance:getByStudent', studentId, start, end),
    getSummary: (sectionId: number, start: string, end: string) => ipcRenderer.invoke('attendance:getSummary', sectionId, start, end)
  },
  marks: {
    createSubject: (schoolId: number, classId: number, name: string, passingMarks: number | null) => ipcRenderer.invoke('marks:createSubject', schoolId, classId, name, passingMarks),
    getSubjects: (classId: number) => ipcRenderer.invoke('marks:getSubjects', classId),
    deleteSubject: (id: number) => ipcRenderer.invoke('marks:deleteSubject', id),
    createExam: (schoolId: number, year: string, name: string, date: string | null, examType: string, weight: number, classId?: number) => ipcRenderer.invoke('marks:createExam', schoolId, year, name, date, examType, weight, classId),
    getExams: (schoolId: number, year: string) => ipcRenderer.invoke('marks:getExams', schoolId, year),
    getExamsByClass: (classId: number, year: string) => ipcRenderer.invoke('marks:getExamsByClass', classId, year),
    markExamCompleted: (examId: number, date: string) => ipcRenderer.invoke('marks:markExamCompleted', examId, date),
    deleteExam: (id: number) => ipcRenderer.invoke('marks:deleteExam', id),
    upsert: (data: any) => ipcRenderer.invoke('marks:upsert', data),
    getByExam: (examId: number) => ipcRenderer.invoke('marks:getByExam', examId),
    getByStudent: (studentId: number) => ipcRenderer.invoke('marks:getByStudent', studentId),
    getClassMarks: (classId: number, examId: number) => ipcRenderer.invoke('marks:getClassMarks', classId, examId)
  },
  promotions: {
    promote: (data: any) => ipcRenderer.invoke('promotions:promote', data),
    getByYear: (year: string) => ipcRenderer.invoke('promotions:getByYear', year),
    getByStudent: (studentId: number) => ipcRenderer.invoke('promotions:getByStudent', studentId)
  },
  archives: {
    archive: (schoolId: number, year: string) => ipcRenderer.invoke('archives:archive', schoolId, year),
    get: (schoolId: number) => ipcRenderer.invoke('archives:get', schoolId),
    getData: (schoolId: number, year: string) => ipcRenderer.invoke('archives:getData', schoolId, year),
    delete: (id: number) => ipcRenderer.invoke('archives:delete', id),
    importData: (schoolId: number, year: string, students: any[]) => ipcRenderer.invoke('archives:import', schoolId, year, students)
  }
})

