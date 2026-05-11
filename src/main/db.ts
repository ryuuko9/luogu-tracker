import initSqlJs, { type BindParams, Database } from 'sql.js'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { normalizeKnowledgeTagNames } from './knowledgeTags'

let db: Database
let dbPath: string
const TAG_CATALOG_FILTER_VERSION = 'knowledge-tag-type2-v1'

function getUserVersion(): number {
  const rows = db.exec('PRAGMA user_version')
  return rows.length > 0 ? rows[0].values[0][0] as number : 0
}

function hasColumn(table: string, column: string): boolean {
  const rows = db.exec(`PRAGMA table_info(${table})`)
  if (rows.length === 0) return false
  return rows[0].values.some(value => String(value[1]) === column)
}

function hasTable(table: string): boolean {
  const rows = db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`)
  return rows.length > 0 && rows[0].values.length > 0
}

function parseTagJson(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]')) as unknown
    return Array.isArray(parsed) ? parsed.map(tag => String(tag)) : []
  } catch {
    return []
  }
}

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
  const version = getUserVersion()

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

  if (version < 3) {
    if (!hasColumn('problems', 'original_tags')) {
      db.run(`ALTER TABLE problems ADD COLUMN original_tags TEXT DEFAULT '[]'`)
    }
    if (!hasColumn('problems', 'user_tags')) {
      db.run(`ALTER TABLE problems ADD COLUMN user_tags TEXT DEFAULT '[]'`)
    }
    if (!hasColumn('problems', 'hidden_original_tags')) {
      db.run(`ALTER TABLE problems ADD COLUMN hidden_original_tags TEXT DEFAULT '[]'`)
    }

    db.run(`
      UPDATE problems
      SET original_tags = CASE
        WHEN COALESCE(original_tags, '[]') = '[]' THEN COALESCE(tags, '[]')
        ELSE original_tags
      END
    `)
    db.run(`UPDATE problems SET user_tags = COALESCE(user_tags, '[]')`)
    db.run(`UPDATE problems SET hidden_original_tags = COALESCE(hidden_original_tags, '[]')`)

    db.run(`
      CREATE TABLE IF NOT EXISTS tag_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        updated_at TEXT NOT NULL
      )
    `)
    db.run('CREATE INDEX IF NOT EXISTS idx_tag_catalog_name ON tag_catalog(name)')
    db.run('PRAGMA user_version = 3')
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

  const version = getUserVersion()
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
    `
      INSERT INTO problems (
        training_id, pid, title, difficulty, tags, original_tags, user_tags, hidden_original_tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [trainingId, pid, title, difficulty, tags, tags, '[]', '[]']
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

export function updateProblemTags(id: number, userTags: string, hiddenOriginalTags: string): void {
  run(
    'UPDATE problems SET user_tags = ?, hidden_original_tags = ? WHERE id = ?',
    [userTags, hiddenOriginalTags, id]
  )
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

export function getTagCatalog(): { tags: string[]; updatedAt: string | null } {
  if (!hasTable('tag_catalog')) {
    return { tags: [], updatedAt: null }
  }

  if (getSetting('tag_catalog_filter_version') !== TAG_CATALOG_FILTER_VERSION) {
    return { tags: [], updatedAt: null }
  }

  const rows = queryAll('SELECT name FROM tag_catalog ORDER BY name COLLATE NOCASE ASC')
  return {
    tags: rows.map(row => String(row.name ?? '')),
    updatedAt: getSetting('tag_catalog_updated_at')
  }
}

export function replaceTagCatalog(tags: string[]): { tags: string[]; updatedAt: string } {
  ensureSettingsTable()

  if (!hasTable('tag_catalog')) {
    db.run(`
      CREATE TABLE IF NOT EXISTS tag_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        updated_at TEXT NOT NULL
      )
    `)
    db.run('CREATE INDEX IF NOT EXISTS idx_tag_catalog_name ON tag_catalog(name)')
  }

  const normalizedTags = normalizeKnowledgeTagNames(tags)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const updatedAt = new Date().toISOString()

  db.run('DELETE FROM tag_catalog')
  for (const tag of normalizedTags) {
    db.run('INSERT INTO tag_catalog (name, updated_at) VALUES (?, ?)', [tag, updatedAt])
  }
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tag_catalog_updated_at', updatedAt])
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tag_catalog_filter_version', TAG_CATALOG_FILTER_VERSION])
  save()

  return { tags: normalizedTags, updatedAt }
}

export function sanitizeProblemKnowledgeTags(knowledgeTags: string[]): void {
  const allowedTags = new Set(normalizeKnowledgeTagNames(knowledgeTags))
  if (allowedTags.size === 0 || !hasTable('problems')) return

  const rows = queryAll('SELECT * FROM problems')
  const hasOriginalTags = hasColumn('problems', 'original_tags')
  const hasUserTags = hasColumn('problems', 'user_tags')
  const hasHiddenOriginalTags = hasColumn('problems', 'hidden_original_tags')
  let changed = false

  for (const row of rows) {
    const id = Number(row.id)
    const nextTags = normalizeKnowledgeTagNames(parseTagJson(row.tags), allowedTags)

    if (hasOriginalTags && hasUserTags && hasHiddenOriginalTags) {
      const nextOriginalTags = normalizeKnowledgeTagNames(parseTagJson(row.original_tags ?? row.tags), allowedTags)
      const nextUserTags = normalizeKnowledgeTagNames(parseTagJson(row.user_tags), allowedTags)
      const nextHiddenOriginalTags = normalizeKnowledgeTagNames(parseTagJson(row.hidden_original_tags), new Set(nextOriginalTags))

      if (
        JSON.stringify(nextTags) !== String(row.tags ?? '[]')
        || JSON.stringify(nextOriginalTags) !== String(row.original_tags ?? '[]')
        || JSON.stringify(nextUserTags) !== String(row.user_tags ?? '[]')
        || JSON.stringify(nextHiddenOriginalTags) !== String(row.hidden_original_tags ?? '[]')
      ) {
        db.run(
          `
            UPDATE problems
            SET tags = ?, original_tags = ?, user_tags = ?, hidden_original_tags = ?
            WHERE id = ?
          `,
          [
            JSON.stringify(nextTags),
            JSON.stringify(nextOriginalTags),
            JSON.stringify(nextUserTags),
            JSON.stringify(nextHiddenOriginalTags),
            id
          ]
        )
        changed = true
      }
      continue
    }

    if (JSON.stringify(nextTags) !== String(row.tags ?? '[]')) {
      db.run('UPDATE problems SET tags = ? WHERE id = ?', [JSON.stringify(nextTags), id])
      changed = true
    }
  }

  if (changed) {
    save()
  }
}

export function setSetting(key: string, value: string): void {
  ensureSettingsTable()
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

export function deleteSetting(key: string): void {
  ensureSettingsTable()
  run('DELETE FROM settings WHERE key = ?', [key])
}
