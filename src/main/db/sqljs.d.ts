declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): QueryExecResult[];
    export(): Uint8Array;
    prepare(sql: string): Statement;
  }
  export interface Statement {
    bind(params?: any[]): void;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
  }
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
