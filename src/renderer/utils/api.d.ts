export interface Api {
  app: {
    isSetupComplete: () => Promise<boolean>
    getSchool: () => Promise<any>
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
    update: (id: number, data: any) => Promise<void>
    withdraw: (id: number) => Promise<void>
    move: (id: number, sectionId: number) => Promise<void>
    search: (query: string, schoolId: number) => Promise<any[]>
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
}

declare global {
  interface Window {
    api: Api
  }
}
