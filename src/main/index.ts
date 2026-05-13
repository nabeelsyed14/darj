import { app, BrowserWindow, ipcMain, dialog, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'fs'
import { initDb, closeDb, saveDb } from './db/connection'
import * as schools from './db/queries/schools'
import * as auth from './db/queries/auth'
import * as students from './db/queries/students'
import * as fields from './db/queries/fields'
import * as classes from './db/queries/classes'
import * as sections from './db/queries/sections'
import * as modules from './db/queries/modules'
import * as settings from './db/queries/settings'
import * as attendance from './db/queries/attendance'
import * as marks from './db/queries/marks'
import * as promotions from './db/queries/promotions'
import * as archives from './db/queries/archives'
import * as status from './db/queries/status'

let logPath = ''
function log(msg: string) {
  try {
    if (!logPath) logPath = join(app.getPath('appData'), 'Darj', 'debug.log')
    const dir = join(app.getPath('appData'), 'Darj')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(logPath, new Date().toISOString() + ' ' + msg + '\n', { flag: 'a' })
  } catch {}
}

process.on('uncaughtException', (e) => log('UNCAUGHT: ' + e.message + '\n' + e.stack))
process.on('unhandledRejection', (e) => log('UNHANDLED REJECTION: ' + String(e)))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  log('createWindow called, __dirname=' + __dirname)
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'assets', 'logo.ico')
    : join(app.getAppPath(), 'assets', 'logo.ico')
  const icon = nativeImage.createFromPath(iconPath)
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    frame: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    log('ready-to-show, showing window')
    mainWindow!.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    log('did-fail-load: ' + code + ' ' + desc)
  })

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.on('maximize', () => mainWindow?.webContents.send('maximize-changed', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('maximize-changed', false))

  const indexPath = join(__dirname, '../index.html')
  log('Loading: ' + indexPath)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(indexPath).catch((e) => log('loadFile error: ' + e.message))
  }
}

app.whenReady().then(async () => {
  log('app.whenReady fired')
  app.setAppUserModelId('com.darj.app')
  Menu.setApplicationMenu(null)
  try {
    await initDb()
    log('initDb succeeded')
  } catch (e: any) {
    log('initDb FAILED: ' + e.message + '\n' + e.stack)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers
ipcMain.handle('app:isSetupComplete', () => { const r = schools.isSetupComplete(); saveDb(); return r })
ipcMain.handle('app:getSchool', () => { const r = schools.getSchool(); saveDb(); return r })
ipcMain.handle('app:logError', (_e, msg: string) => log('RENDERER: ' + msg))
ipcMain.handle('app:isMaximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('app:minimize', () => mainWindow?.minimize())
ipcMain.handle('app:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize() })
ipcMain.handle('app:close', () => mainWindow?.close())



ipcMain.handle('schools:create', (_e, data) => { const r = schools.createSchool(data); saveDb(); return r })
ipcMain.handle('schools:update', (_e, data) => { schools.updateSchool(data); saveDb() })

ipcMain.handle('auth:create', async (_e, schoolId: number, password: string) => {
  try {
    const r = auth.createUser(schoolId, password)
    saveDb()
    return r
  } catch (e: any) {
    log('auth:create error: ' + e.message)
    throw e
  }
})
ipcMain.handle('auth:verifyLogin', (_e, password: string) => auth.verifyLogin(password))
ipcMain.handle('auth:resetPassword', (_e, recoveryKey: string, newPassword: string) => { const r = auth.resetPassword(recoveryKey, newPassword); saveDb(); return r })
ipcMain.handle('auth:changePassword', (_e, current: string, newPass: string) => { const r = auth.changePassword(current, newPass); saveDb(); return r })

ipcMain.handle('students:create', (_e, data) => { const r = students.createStudent(data); saveDb(); return r })
ipcMain.handle('students:get', (_e, id: number) => students.getStudent(id))
ipcMain.handle('students:getBySection', (_e, sectionId: number) => students.getStudentsBySection(sectionId))
ipcMain.handle('students:getAllBySection', (_e, sectionId: number) => students.getAllStudentsBySection(sectionId))
ipcMain.handle('students:update', (_e, id: number, data) => { students.updateStudent(id, data); saveDb() })
ipcMain.handle('students:withdraw', (_e, id: number) => { students.withdrawStudent(id); saveDb() })
ipcMain.handle('students:move', (_e, id: number, sectionId: number) => { students.moveStudent(id, sectionId); saveDb() })
ipcMain.handle('students:updatePhoto', (_e, id: number, photo: string) => { students.updateStudentPhoto(id, photo); saveDb() })
ipcMain.handle('students:search', (_e, query: string, schoolId: number) => students.searchStudents(query, schoolId))

ipcMain.handle('fields:defaults', () => fields.getDefaultFields())
ipcMain.handle('fields:create', async (_e, schoolId: number, f: any[]) => {
  try {
    fields.createFields(schoolId, f)
    saveDb()
  } catch (e: any) {
    log('fields:create error: ' + e.message)
    throw e
  }
})
ipcMain.handle('fields:get', (_e, schoolId: number) => fields.getFields(schoolId))
ipcMain.handle('fields:add', (_e, data) => { fields.addField(data); saveDb() })
ipcMain.handle('fields:update', (_e, id: number, data) => { fields.updateField(id, data); saveDb() })
ipcMain.handle('fields:remove', (_e, id: number) => { fields.removeField(id); saveDb() })
ipcMain.handle('fields:reorder', (_e, ids: number[]) => { fields.reorderFields(ids); saveDb() })

ipcMain.handle('classes:create', (_e, schoolId: number, name: string) => { const r = classes.createClass(schoolId, name); saveDb(); return r })
ipcMain.handle('classes:get', (_e, schoolId: number) => classes.getClasses(schoolId))
ipcMain.handle('classes:update', (_e, id: number, name: string) => { classes.updateClass(id, name); saveDb() })
ipcMain.handle('classes:delete', (_e, id: number) => { classes.deleteClass(id); saveDb() })

ipcMain.handle('sections:create', (_e, classId: number, name: string, teacher: string | null) => { const r = sections.createSection(classId, name, teacher); saveDb(); return r })
ipcMain.handle('sections:getByClass', (_e, classId: number) => sections.getSectionsByClass(classId))
ipcMain.handle('sections:getAll', (_e, schoolId: number) => sections.getAllSections(schoolId))
ipcMain.handle('sections:update', (_e, id: number, data) => { sections.updateSection(id, data); saveDb() })
ipcMain.handle('sections:delete', (_e, id: number) => { sections.deleteSection(id); saveDb() })

ipcMain.handle('modules:enable', (_e, schoolId: number, keys: string[]) => { modules.enableModules(schoolId, keys); saveDb() })
ipcMain.handle('modules:get', (_e, schoolId: number) => modules.getModules(schoolId))
ipcMain.handle('modules:toggle', (_e, schoolId: number, key: string, enabled: boolean) => { modules.toggleModule(schoolId, key, enabled); saveDb() })

ipcMain.handle('settings:get', (_e, schoolId: number, key: string) => settings.getSetting(schoolId, key))
ipcMain.handle('settings:set', (_e, schoolId: number, key: string, value: string) => { settings.setSetting(schoolId, key, value); saveDb() })
ipcMain.handle('settings:getAll', (_e, schoolId: number) => settings.getAllSettings(schoolId))

ipcMain.handle('attendance:mark', (_e, data) => { attendance.markAttendance(data); saveDb() })
ipcMain.handle('attendance:markBulk', (_e, records: any[]) => { attendance.markAttendanceBulk(records); saveDb() })
ipcMain.handle('attendance:getByDate', (_e, sectionId: number, date: string) => attendance.getAttendanceByDate(sectionId, date))
ipcMain.handle('attendance:getByStudent', (_e, studentId: number, start: string, end: string) => attendance.getAttendanceByStudent(studentId, start, end))
ipcMain.handle('attendance:getSummary', (_e, sectionId: number, start: string, end: string) => attendance.getAttendanceSummary(sectionId, start, end))

ipcMain.handle('marks:createSubject', (_e, schoolId: number, classId: number, name: string, passingMarks: number | null) => { const r = marks.createSubject(schoolId, classId, name, passingMarks); saveDb(); return r })
ipcMain.handle('marks:getSubjects', (_e, classId: number) => marks.getSubjectsByClass(classId))
ipcMain.handle('marks:deleteSubject', (_e, id: number) => { marks.deleteSubject(id); saveDb() })
ipcMain.handle('marks:createExam', (_e, schoolId: number, year: string, name: string, date: string | null, examType: string, weight: number, classId?: number) => { const r = marks.createExam(schoolId, year, name, date, examType, weight, classId); saveDb(); return r })
ipcMain.handle('marks:getExams', (_e, schoolId: number, year: string) => marks.getExams(schoolId, year))
ipcMain.handle('marks:getExamsByClass', (_e, classId: number, year: string) => marks.getExamsByClass(classId, year))
ipcMain.handle('marks:markExamCompleted', (_e, examId: number, date: string) => { marks.markExamCompleted(examId, date); saveDb() })
ipcMain.handle('marks:deleteExam', (_e, id: number) => { marks.deleteExam(id); saveDb() })
ipcMain.handle('marks:upsert', (_e, data) => { marks.upsertMark(data); saveDb() })
ipcMain.handle('marks:getByExam', (_e, examId: number) => marks.getMarksByExam(examId))
ipcMain.handle('marks:getByStudent', (_e, studentId: number) => marks.getMarksByStudent(studentId))
ipcMain.handle('marks:getClassMarks', (_e, classId: number, examId: number) => marks.getClassMarks(classId, examId))

ipcMain.handle('promotions:promote', (_e, data) => { promotions.promoteStudent(data); saveDb() })
ipcMain.handle('promotions:getByYear', (_e, year: string) => promotions.getPromotionsByYear(year))
ipcMain.handle('promotions:getByStudent', (_e, studentId: number) => promotions.getStudentPromotions(studentId))

ipcMain.handle('archives:archive', (_e, schoolId: number, year: string) => { archives.archiveYear(schoolId, year) })
ipcMain.handle('archives:get', (_e, schoolId: number) => archives.getArchives(schoolId))
ipcMain.handle('archives:getData', (_e, schoolId: number, year: string) => archives.getArchive(schoolId, year))
ipcMain.handle('archives:delete', (_e, id: number) => { archives.deleteArchive(id); saveDb() })
ipcMain.handle('archives:import', (_e, schoolId: number, year: string, students: any[]) => { archives.importArchiveData(schoolId, year, students); saveDb() })

ipcMain.handle('students:changeStatus', (_e, id: number, oldStatus: string, newStatus: string, reason: string, effectiveDate: string) => { status.updateStudentStatus(id, oldStatus, newStatus, reason, effectiveDate); saveDb() })
ipcMain.handle('students:getStatusHistory', (_e, id: number) => status.getStatusHistory(id))

ipcMain.handle('app:backup', async () => {
  const dateStr = new Date().toISOString().split('T')[0]
  const result = await dialog.showSaveDialog({
    title: 'Save Backup',
    defaultPath: 'Darj_Backup_' + dateStr + '.db',
    filters: [{ name: 'Database', extensions: ['db'] }]
  })
  if (result.filePath) {
    const dbPath = join(app.getPath('appData'), 'Darj', 'data.db')
    copyFileSync(dbPath, result.filePath)
    return { success: true, path: result.filePath }
  }
  return { success: false }
})

ipcMain.handle('app:restore', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Backup File',
    filters: [{ name: 'Database', extensions: ['db'] }],
    properties: ['openFile']
  })
  if (result.filePaths.length > 0) {
    const dbPath = join(app.getPath('appData'), 'Darj', 'data.db')
    closeDb()
    const backupData = readFileSync(result.filePaths[0])
    writeFileSync(dbPath, backupData)
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle('app:saveToDesktop', async (_e, filename: string, data: number[]) => {
  try {
    const desktopPath = app.getPath('desktop')
    const safeName = String(filename || 'Darj_Export.xlsx').replace(/[\\/:*?"<>|]/g, '_')
    const fullPath = join(desktopPath, safeName)
    writeFileSync(fullPath, Buffer.from(data))
    return { success: true, path: fullPath }
  } catch (e: any) {
    log('app:saveToDesktop error: ' + e.message)
    return { success: false, error: e?.message || 'Failed to save file' }
  }
})


