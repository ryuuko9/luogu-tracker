declare module 'sql.js' {
  export type BindScalar = string | number | boolean | null | Uint8Array
  export type BindParams = BindScalar[] | Record<string, BindScalar>

  export interface QueryExecResult {
    columns: string[]
    values: Array<Array<string | number | null>>
  }

  export interface Statement {
    bind(values?: BindParams): void
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }

  export interface Database {
    run(sql: string, params?: BindParams): void
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Uint8Array) => Database
  }

  export interface SqlJsConfig {
    wasmBinary?: Uint8Array
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
