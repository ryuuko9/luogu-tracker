import initSqlJs, { type BindParams, Database } from 'sql.js'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'

let db: Database
let dbPath: string

function save(): void {
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

export async function initDatabase(): Promise<void> {
  // 显式提供 WASM 二进制文件路径，确保在 Electron 中正确加载
  const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
  const wasmBinary = existsSync(wasmPath) ? readFileSync(wasmPath) : undefined
  const SQL = await initSqlJs({ wasmBinary })
  dbPath = path.join(app.getPath('userData'), 'luogu-tracker.db')

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  migrate()
  save()
}

function migrate(): void {
  const rows = db.exec('PRAGMA user_version')
  const version = rows.length > 0 ? rows[0].values[0][0] as number : 0

  if (version < 1) {
    db.run(`
      CREATE TABLE IF NOT EXISTS trainings (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        problem_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        training_id INTEGER NOT NULL,
        pid TEXT NOT NULL,
        title TEXT NOT NULL,
        difficulty INTEGER DEFAULT -1,
        tags TEXT DEFAULT '[]',
        completed INTEGER DEFAULT 0,
        note TEXT DEFAULT '',
        FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
      )
    `)
    db.run('CREATE INDEX IF NOT EXISTS idx_problems_training ON problems(training_id)')
    db.run('PRAGMA user_version = 1')
  }

  if (version < 2) {
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    db.run('PRAGMA user_version = 2')
  }
}

// === 辅助函数 ===

function queryAll(sql: string, params: BindParams = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function queryOne(sql: string, params: BindParams = []): Record<string, unknown> | undefined {
  return queryAll(sql, params)[0]
}

function run(sql: string, params: BindParams = []): void {
  db.run(sql, params)
  save()
}

function ensureSettingsTable(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  const versionRow = db.exec('PRAGMA user_version')
  const version = versionRow.length > 0 ? versionRow[0].values[0][0] as number : 0
  if (version < 2) {
    db.run('PRAGMA user_version = 2')
    save()
  }
}

// === 题单 CRUD ===

export function insertTraining(id: number, name: string, description: string, problemCount: number): void {
  run(
    'INSERT OR REPLACE INTO trainings (id, name, description, problem_count) VALUES (?, ?, ?, ?)',
    [id, name, description, problemCount]
  )
}

export function getAllTrainings(): Record<string, unknown>[] {
  return queryAll('SELECT * FROM trainings ORDER BY created_at DESC')
}

export function deleteTraining(id: number): void {
  run('DELETE FROM problems WHERE training_id = ?', [id])
  run('DELETE FROM trainings WHERE id = ?', [id])
}

// === 题目 CRUD ===

export function insertProblem(
  trainingId: number, pid: string, title: string,
  difficulty: number, tags: string
): void {
  run(
    'INSERT INTO problems (training_id, pid, title, difficulty, tags) VALUES (?, ?, ?, ?, ?)',
    [trainingId, pid, title, difficulty, tags]
  )
}

export function getProblemsByTraining(trainingId: number): Record<string, unknown>[] {
  return queryAll('SELECT * FROM problems WHERE training_id = ?', [trainingId])
}

export function toggleProblemCompleted(id: number): number {
  const row = queryOne('SELECT completed FROM problems WHERE id = ?', [id])
  if (!row) return 0
  const newVal = Number(row.completed ?? 0) === 1 ? 0 : 1
  run('UPDATE problems SET completed = ? WHERE id = ?', [newVal, id])
  return newVal
}

export function updateProblemNote(id: number, note: string): void {
  run('UPDATE problems SET note = ? WHERE id = ?', [note, id])
}

export function getCompletedCount(trainingId: number): number {
  const row = queryOne(
    'SELECT COUNT(*) as cnt FROM problems WHERE training_id = ? AND completed = 1',
    [trainingId]
  )
  return Number(row?.cnt ?? 0)
}

export function getAllTags(): string[] {
  const rows = queryAll('SELECT DISTINCT tags FROM problems')
  const tagSet = new Set<string>()
  for (const row of rows) {
    try {
      const arr = JSON.parse(String(row.tags ?? '[]')) as string[]
      arr.forEach(t => tagSet.add(t))
    } catch { /* ignore */ }
  }
  return [...tagSet].sort()
}

export function getSetting(key: string): string | null {
  ensureSettingsTable()
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
  return typeof row?.value === 'string' ? row.value : null
}

export function setSetting(key: string, value: string): void {
  ensureSettingsTable()
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

export function deleteSetting(key: string): void {
  ensureSettingsTable()
  run('DELETE FROM settings WHERE key = ?', [key])
}
