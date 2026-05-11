# Training Classification And Manual Trainings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为应用增加“导入题单 / 自定义题单”两层归组、自定义分类、新建空题单，以及向自定义题单手动添加和删除任意平台题目的能力。

**Architecture:** 主进程先把题单与题目存储扩成“来源类型 + 平台化题目”模型，再通过新的 IPC 暴露“新建题单 / 增删题目”能力。渲染层新增两个轻量弹窗和一个纯函数分组模块，侧边栏只保留题单相关操作并按“来源类型 -> 分类 -> 题单”展示，主区域右上角统一承载主题切换和头像登录入口，题目区根据题单类型控制编辑权限。

**Tech Stack:** Electron、React、TypeScript、sql.js、node:test

---

## File Map

- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\tsconfig.test.json`
  - 把本次新增的纯逻辑模块和测试纳入现有测试编译链路。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\trainingStore.ts`
  - 承担可测试的题单/题目迁移、校验、CRUD 纯存储逻辑。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\trainingStore.test.ts`
  - 覆盖数据库迁移、新建自定义题单、仅自定义题单可增删题的测试。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\db.ts`
  - 接入 `trainingStore.ts`，保留现有数据库初始化与保存入口。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\ipc.ts`
  - 新增 `create-training`、`create-problem`、`delete-problem`，并扩展导入题单的分类参数。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\preload\index.ts`
  - 暴露新的 IPC API，并更新返回类型。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\types.ts`
  - 扩展 `Training`、`Problem` 类型。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\trainingGroups.ts`
  - 纯函数，把题单列表分组成“来源类型 -> 分类 -> 题单”结构。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\trainingGroups.test.ts`
  - 覆盖分组、未分类兜底、来源排序。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\hooks\useApi.ts`
  - 增加新建题单、添加题目、删除题目 API 封装。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.tsx`
  - 管理新增弹窗状态、当前题单权限，以及主区域右上角的主题/头像入口布局。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\Sidebar.tsx`
  - 改为渲染两层分组列表，仅保留 `新建 / 导入` 两个题单操作按钮。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\CreateTrainingDialog.tsx`
  - 新建自定义题单弹窗。
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\CreateProblemDialog.tsx`
  - 自定义题单添加题目弹窗。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ImportDialog.tsx`
  - 增加分类输入。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ProblemList.tsx`
  - 支持空自定义题单提示、添加题目入口、按题目 URL 打开、删除题目入口。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ProblemItem.tsx`
  - 在自定义题单场景下显示删除题目按钮。
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.css`
  - 补侧边栏分组、自定义题单空状态、对话框字段、删除按钮样式。

### Task 1: 建立可测试的题单存储基础

**Files:**
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\tsconfig.test.json`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\trainingStore.ts`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\trainingStore.test.ts`

- [ ] **Step 1: 写题单迁移与 CRUD 的失败测试**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'

import {
  migrateTrainingSchema,
  createManualTraining,
  createProblemForTraining,
  deleteProblemFromTraining,
  listTrainings,
  listProblemsByTraining,
} from './trainingStore'

test('迁移后旧题单应默认属于导入题单且分类为未分类', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE trainings (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      problem_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.run(`
    CREATE TABLE problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER NOT NULL,
      pid TEXT NOT NULL,
      title TEXT NOT NULL,
      difficulty INTEGER DEFAULT -1,
      tags TEXT DEFAULT '[]',
      completed INTEGER DEFAULT 0,
      note TEXT DEFAULT ''
    )
  `)
  db.run(`INSERT INTO trainings (id, name, description, problem_count) VALUES (100, '旧题单', '', 0)`)
  db.run(`INSERT INTO problems (training_id, pid, title, difficulty, tags) VALUES (100, 'P1001', 'A+B Problem', 1, '[]')`)

  migrateTrainingSchema(db)

  const training = listTrainings(db)[0]
  const problem = listProblemsByTraining(db, 100)[0]

  assert.equal(training.source_type, 'imported')
  assert.equal(training.category, '未分类')
  assert.equal(problem.platform, 'Luogu')
  assert.equal(problem.problem_key, 'P1001')
})

test('应能新建自定义题单并向其中添加题目', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  migrateTrainingSchema(db)

  const training = createManualTraining(db, {
    name: '好题收集',
    description: '最近做过的好题',
    category: '好题',
  })

  createProblemForTraining(db, {
    trainingId: training.id,
    platform: 'Codeforces',
    problemKey: '1700A',
    title: 'Example Problem',
    url: 'https://codeforces.com/problemset/problem/1700/A',
    difficulty: 5,
    tags: ['构造'],
  })

  const problems = listProblemsByTraining(db, training.id)
  assert.equal(training.source_type, 'manual')
  assert.equal(problems).not // 故意错误，先制造失败
})

test('不应允许向导入题单添加题目或删除其内部题目', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  migrateTrainingSchema(db)
  db.run(`
    INSERT INTO trainings (id, name, description, problem_count, source_type, category)
    VALUES (1, '导入题单', '', 1, 'imported', '图论')
  `)
  db.run(`
    INSERT INTO problems (
      training_id, pid, problem_key, platform, title, difficulty, tags, original_tags, user_tags, hidden_original_tags, completed, note, url
    ) VALUES (
      1, 'P3371', 'P3371', 'Luogu', '单源最短路径', 3, '[]', '[]', '[]', '[]', 0, '', 'https://www.luogu.com.cn/problem/P3371'
    )
  `)

  assert.throws(() => createProblemForTraining(db, {
    trainingId: 1,
    platform: 'AtCoder',
    problemKey: 'abc100_a',
    title: 'A',
    url: '',
    difficulty: -1,
    tags: [],
  }))

  assert.throws(() => deleteProblemFromTraining(db, 1))
})
```

- [ ] **Step 2: 运行测试，确认先失败**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/main/trainingStore.test.js`  
Expected: FAIL，至少出现一个断言失败或 `Cannot find module './trainingStore'`

- [ ] **Step 3: 实现最小可测试存储模块**

```ts
import type { Database } from 'sql.js'

export type TrainingSourceType = 'imported' | 'manual'

export interface ManualTrainingDraft {
  name: string
  description: string
  category: string
}

export interface ManualProblemDraft {
  trainingId: number
  platform: string
  problemKey: string
  title: string
  url: string
  difficulty: number
  tags: string[]
}

function normalizeCategory(category: string): string {
  const trimmed = category.trim()
  return trimmed === '' ? '未分类' : trimmed
}

function normalizeText(value: string): string {
  return value.trim()
}

function getTrainingSourceType(db: Database, trainingId: number): TrainingSourceType {
  const row = db.exec(`SELECT source_type FROM trainings WHERE id = ${trainingId}`)
  if (row.length === 0 || row[0].values.length === 0) {
    throw new Error('题单不存在')
  }
  return String(row[0].values[0][0]) as TrainingSourceType
}

export function migrateTrainingSchema(db: Database): void {
  db.run(`ALTER TABLE trainings ADD COLUMN source_type TEXT NOT NULL DEFAULT 'imported'`)
  db.run(`ALTER TABLE trainings ADD COLUMN category TEXT NOT NULL DEFAULT '未分类'`)
  db.run(`ALTER TABLE problems ADD COLUMN platform TEXT NOT NULL DEFAULT 'Luogu'`)
  db.run(`ALTER TABLE problems ADD COLUMN problem_key TEXT NOT NULL DEFAULT ''`)
  db.run(`ALTER TABLE problems ADD COLUMN url TEXT NOT NULL DEFAULT ''`)
  db.run(`UPDATE trainings SET source_type = COALESCE(source_type, 'imported')`)
  db.run(`UPDATE trainings SET category = CASE WHEN TRIM(COALESCE(category, '')) = '' THEN '未分类' ELSE category END`)
  db.run(`UPDATE problems SET platform = COALESCE(platform, 'Luogu')`)
  db.run(`UPDATE problems SET problem_key = CASE WHEN TRIM(COALESCE(problem_key, '')) = '' THEN COALESCE(pid, '') ELSE problem_key END`)
  db.run(`UPDATE problems SET url = COALESCE(url, '')`)
}

export function createManualTraining(db: Database, draft: ManualTrainingDraft) {
  const rows = db.exec(`SELECT COALESCE(MAX(id), 0) FROM trainings`)
  const nextId = Number(rows[0].values[0][0]) + 1
  db.run(
    `INSERT INTO trainings (id, name, description, problem_count, source_type, category) VALUES (?, ?, ?, 0, 'manual', ?)`,
    [nextId, normalizeText(draft.name), normalizeText(draft.description), normalizeCategory(draft.category)],
  )
  return { id: nextId, source_type: 'manual', category: normalizeCategory(draft.category) }
}

export function createProblemForTraining(db: Database, draft: ManualProblemDraft): void {
  if (getTrainingSourceType(db, draft.trainingId) !== 'manual') {
    throw new Error('仅自定义题单允许手动添加题目')
  }
  const tagsJson = JSON.stringify(draft.tags)
  db.run(
    `INSERT INTO problems (
      training_id, pid, problem_key, platform, title, difficulty, tags, original_tags, user_tags, hidden_original_tags, completed, note, url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', 0, '', ?)`,
    [draft.trainingId, draft.problemKey, draft.problemKey, normalizeText(draft.platform), normalizeText(draft.title), draft.difficulty, tagsJson, tagsJson, normalizeText(draft.url)],
  )
  db.run(`UPDATE trainings SET problem_count = (SELECT COUNT(*) FROM problems WHERE training_id = ?) WHERE id = ?`, [draft.trainingId, draft.trainingId])
}

export function deleteProblemFromTraining(db: Database, problemId: number): void {
  const rows = db.exec(`
    SELECT p.training_id, t.source_type
    FROM problems p
    JOIN trainings t ON t.id = p.training_id
    WHERE p.id = ${problemId}
  `)
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new Error('题目不存在')
  }
  if (String(rows[0].values[0][1]) !== 'manual') {
    throw new Error('仅自定义题单允许删除题目')
  }
  const trainingId = Number(rows[0].values[0][0])
  db.run(`DELETE FROM problems WHERE id = ?`, [problemId])
  db.run(`UPDATE trainings SET problem_count = (SELECT COUNT(*) FROM problems WHERE training_id = ?) WHERE id = ?`, [trainingId, trainingId])
}
```

- [ ] **Step 4: 修正测试并补齐列表读取函数**

```ts
test('应能新建自定义题单并向其中添加题目', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  migrateTrainingSchema(db)

  const training = createManualTraining(db, {
    name: '好题收集',
    description: '最近做过的好题',
    category: '好题',
  })

  createProblemForTraining(db, {
    trainingId: training.id,
    platform: 'Codeforces',
    problemKey: '1700A',
    title: 'Example Problem',
    url: 'https://codeforces.com/problemset/problem/1700/A',
    difficulty: 5,
    tags: ['构造'],
  })

  const trainings = listTrainings(db)
  const problems = listProblemsByTraining(db, training.id)

  assert.equal(trainings[0].problem_count, 1)
  assert.equal(problems.length, 1)
  assert.equal(problems[0].platform, 'Codeforces')
  assert.equal(problems[0].problem_key, '1700A')
})
```

- [ ] **Step 5: 再跑测试并提交**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/main/trainingStore.test.js`  
Expected: PASS

```bash
git add tsconfig.test.json src/main/trainingStore.ts src/main/trainingStore.test.ts
git commit -m "feat: add training store for manual trainings"
```

### Task 2: 把新存储模型接回主进程数据库与 IPC

**Files:**
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\db.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\main\ipc.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\preload\index.ts`

- [ ] **Step 1: 写失败测试，锁定导入分类和主进程返回字段**

```ts
test('导入题单列表应返回来源类型与分类字段', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  migrateTrainingSchema(db)
  db.run(`
    INSERT INTO trainings (id, name, description, problem_count, source_type, category)
    VALUES (100, '图论入门', '', 2, 'imported', '图论')
  `)

  const training = listTrainings(db)[0]
  assert.equal(training.source_type, 'imported')
  assert.equal(training.category, '图论')
})
```

- [ ] **Step 2: 运行目标测试，确认当前主进程层还不满足计划输出**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/main/trainingStore.test.js`  
Expected: FAIL，返回结构尚未被 `db.ts` / `ipc.ts` 使用

- [ ] **Step 3: 在 `db.ts` 中接入新存储函数并扩展导入写入参数**

```ts
import {
  migrateTrainingSchema,
  createManualTraining,
  createProblemForTraining,
  deleteProblemFromTraining,
  listTrainings,
  listProblemsByTraining,
} from './trainingStore'

function migrate(): void {
  const version = getUserVersion()
  // 保留现有 v1/v2/v3 迁移
  migrateTrainingSchema(db)
  if (version < 4) {
    db.run('PRAGMA user_version = 4')
  }
}

export function insertTraining(
  id: number,
  name: string,
  description: string,
  problemCount: number,
  sourceType = 'imported',
  category = '未分类',
): void {
  run(
    `INSERT OR REPLACE INTO trainings (id, name, description, problem_count, source_type, category) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, description, problemCount, sourceType, category.trim() || '未分类'],
  )
}

export function createManualTrainingEntry(name: string, description: string, category: string) {
  const created = createManualTraining(db, { name, description, category })
  save()
  return created
}

export function createManualProblemEntry(draft: {
  trainingId: number
  platform: string
  problemKey: string
  title: string
  url: string
  difficulty: number
  tags: string[]
}) {
  createProblemForTraining(db, draft)
  save()
}

export function deleteManualProblemEntry(problemId: number) {
  deleteProblemFromTraining(db, problemId)
  save()
}
```

- [ ] **Step 4: 在 `ipc.ts` 与 `preload/index.ts` 暴露新能力**

```ts
ipcMain.handle('import-training', async (_event, input: string, category: string) => {
  const loginStatus = await getLoginStatus(luoguSession)
  const data = await scrapeTraining(input, luoguSession, Boolean(loginStatus))

  db.insertTraining(
    data.training.id,
    data.training.name,
    data.training.description,
    data.training.problemCount,
    'imported',
    category,
  )

  for (const p of data.problems) {
    db.insertProblem(
      data.training.id,
      p.pid,
      p.title,
      p.difficulty,
      JSON.stringify(p.tags),
      'Luogu',
      p.pid,
      `https://www.luogu.com.cn/problem/${p.pid}`,
    )
  }
})

ipcMain.handle('create-training', (_event, payload: { name: string; description: string; category: string }) => {
  const created = db.createManualTrainingEntry(payload.name, payload.description, payload.category)
  return {
    id: created.id,
    name: payload.name.trim(),
    description: payload.description.trim(),
    problemCount: 0,
    completedCount: 0,
    createdAt: new Date().toISOString(),
    sourceType: 'manual',
    category: payload.category.trim() || '未分类',
  }
})

ipcMain.handle('create-problem', (_event, payload) => {
  db.createManualProblemEntry(payload)
})

ipcMain.handle('delete-problem', (_event, problemId: number) => {
  db.deleteManualProblemEntry(problemId)
})
```

```ts
const api = {
  importTraining: (input: string, category: string) => ipcRenderer.invoke('import-training', input, category),
  createTraining: (payload: { name: string; description: string; category: string }) => ipcRenderer.invoke('create-training', payload),
  createProblem: (payload: {
    trainingId: number
    platform: string
    problemKey: string
    title: string
    url: string
    difficulty: number
    tags: string[]
  }) => ipcRenderer.invoke('create-problem', payload),
  deleteProblem: (problemId: number) => ipcRenderer.invoke('delete-problem', problemId),
}
```

- [ ] **Step 5: 运行类型检查与测试并提交**

Run: `npm run typecheck && npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/main/trainingStore.test.js`  
Expected: PASS

```bash
git add src/main/db.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat: expose manual training ipc flows"
```

### Task 3: 加入前端题单分组纯函数与测试

**Files:**
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\tsconfig.test.json`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\trainingGroups.ts`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\trainingGroups.test.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\types.ts`

- [ ] **Step 1: 写题单分组的失败测试**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import { groupTrainingsBySourceAndCategory } from './trainingGroups'

test('应按来源类型和分类分组，并把空分类归到未分类', () => {
  const groups = groupTrainingsBySourceAndCategory([
    {
      id: 1,
      name: '图论导入题单',
      description: '',
      problemCount: 2,
      createdAt: '2026-05-11T00:00:00.000Z',
      completedCount: 0,
      sourceType: 'imported',
      category: '图论',
    },
    {
      id: 2,
      name: '我的好题',
      description: '',
      problemCount: 1,
      createdAt: '2026-05-11T00:01:00.000Z',
      completedCount: 0,
      sourceType: 'manual',
      category: '',
    },
  ])

  assert.deepEqual(groups.map(group => group.sourceType), ['imported', 'manual'])
  assert.equal(groups[0].categories[0].name, '图论')
  assert.equal(groups[1].categories[0].name, '未分类')
})
```

- [ ] **Step 2: 运行测试，确认模块缺失导致失败**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/renderer/src/trainingGroups.test.js`  
Expected: FAIL with `Cannot find module './trainingGroups'`

- [ ] **Step 3: 扩展前端类型并实现分组函数**

```ts
export interface Training {
  id: number
  name: string
  description: string
  problemCount: number
  createdAt: string
  completedCount: number
  sourceType: 'imported' | 'manual'
  category: string
}
```

```ts
import type { Training } from './types'

export interface TrainingCategoryGroup {
  name: string
  trainings: Training[]
}

export interface TrainingSourceGroup {
  sourceType: 'imported' | 'manual'
  title: string
  categories: TrainingCategoryGroup[]
}

const SOURCE_ORDER: Array<Training['sourceType']> = ['imported', 'manual']

function normalizeCategory(category: string): string {
  const trimmed = category.trim()
  return trimmed === '' ? '未分类' : trimmed
}

export function groupTrainingsBySourceAndCategory(trainings: Training[]): TrainingSourceGroup[] {
  return SOURCE_ORDER.map(sourceType => {
    const current = trainings.filter(training => training.sourceType === sourceType)
    const categoryMap = new Map<string, Training[]>()

    for (const training of current) {
      const key = normalizeCategory(training.category)
      const next = categoryMap.get(key) ?? []
      next.push({ ...training, category: key })
      categoryMap.set(key, next)
    }

    const categories = [...categoryMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
      .map(([name, groupedTrainings]) => ({ name, trainings: groupedTrainings }))

    return {
      sourceType,
      title: sourceType === 'imported' ? '导入题单' : '自定义题单',
      categories,
    }
  }).filter(group => group.categories.length > 0)
}
```

- [ ] **Step 4: 把测试纳入测试编译配置**

```json
{
  "include": [
    "src/main/trainingStore.ts",
    "src/main/trainingStore.test.ts",
    "src/renderer/src/trainingGroups.ts",
    "src/renderer/src/trainingGroups.test.ts"
  ]
}
```

- [ ] **Step 5: 再跑测试并提交**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/renderer/src/trainingGroups.test.js`  
Expected: PASS

```bash
git add tsconfig.test.json src/renderer/src/types.ts src/renderer/src/trainingGroups.ts src/renderer/src/trainingGroups.test.ts
git commit -m "feat: add training grouping helpers"
```

### Task 4: 接入题单创建、侧边栏分组展示与主区域头像入口调整

**Files:**
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\hooks\useApi.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\Sidebar.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ImportDialog.tsx`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\CreateTrainingDialog.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.css`

- [ ] **Step 1: 先写分组渲染所需的使用方式测试草图**

```ts
test('分组结果应保留导入题单在前、自定义题单在后', () => {
  const groups = groupTrainingsBySourceAndCategory([
    { id: 2, name: '我的好题', description: '', problemCount: 0, createdAt: '', completedCount: 0, sourceType: 'manual', category: '好题' },
    { id: 1, name: '图论导入', description: '', problemCount: 0, createdAt: '', completedCount: 0, sourceType: 'imported', category: '图论' },
  ])

  assert.equal(groups[0].title, '导入题单')
  assert.equal(groups[1].title, '自定义题单')
})
```

- [ ] **Step 2: 运行现有分组测试，确认排序约束仍被覆盖**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/renderer/src/trainingGroups.test.js`  
Expected: PASS

- [ ] **Step 3: 扩展 `useApi.ts` 和 `App.tsx` 的新建题单流程，并预留主区域右上角账号入口状态**

```ts
const createTraining = useCallback(async (payload: {
  name: string
  description: string
  category: string
}) => {
  const created = await window.api.createTraining(payload)
  await fetchTrainings()
  return created
}, [fetchTrainings])

const importTraining = useCallback(async (input: string, category: string) => {
  setImporting(true)
  try {
    await window.api.importTraining(input, category)
    await fetchTrainings()
  } finally {
    setImporting(false)
  }
}, [fetchTrainings])
```

```tsx
const [showCreateTraining, setShowCreateTraining] = useState(false)
const [showLoginDialog, setShowLoginDialog] = useState(false)

const handleCreateTraining = useCallback(async (payload: {
  name: string
  description: string
  category: string
}) => {
  const created = await createTraining(payload)
  setShowCreateTraining(false)
  setSelectedTrainingId(created.id)
}, [createTraining])
```

- [ ] **Step 4: 改造侧边栏和导入/新建弹窗**

```tsx
  <Sidebar
  trainings={trainings}
  selectedId={selectedTrainingId}
  onSelect={setSelectedTrainingId}
  onDelete={handleRequestDelete}
  onImport={() => setShowImport(true)}
  onCreateTraining={() => setShowCreateTraining(true)}
  userInfo={userInfo}
  onLogin={handleLogin}
  onOpenLoginDialog={() => setShowLoginDialog(true)}
/>

<ImportDialog
  visible={showImport}
  importing={importing}
  onImport={handleImport}
  onClose={() => setShowImport(false)}
/>

<CreateTrainingDialog
  visible={showCreateTraining}
  onCreate={handleCreateTraining}
  onClose={() => setShowCreateTraining(false)}
/>
```

```tsx
const groupedTrainings = groupTrainingsBySourceAndCategory(trainings)

return (
  <aside className="sidebar">
    <div className="sidebar-header">
      <h2>题单列表</h2>
      <div className="sidebar-header-actions">
        <button className="btn-import" onClick={onImport}>+ 导入</button>
        <button className="btn-import" onClick={onCreateTraining}>+ 新建</button>
      </div>
    </div>
    <div className="sidebar-list">
      {groupedTrainings.map(group => (
        <section key={group.sourceType} className="sidebar-section">
          <div className="sidebar-section-title">{group.title}</div>
          {group.categories.map(category => (
            <div key={`${group.sourceType}-${category.name}`} className="sidebar-category">
              <div className="sidebar-category-title">{category.name}</div>
              {category.trainings.map(training => (
                <div key={training.id} className={`sidebar-item ${training.id === selectedId ? 'selected' : ''}`}>
                  {/* 复用现有题单卡片内容 */}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  </aside>
)
```

```tsx
<div className="main-header-actions">
  <button
    className="btn-theme"
    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
    title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
    aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
  >
    <span className="btn-theme-icon" aria-hidden="true">
      {theme === 'light' ? '🌙' : '☀️'}
    </span>
  </button>
  {userInfo ? (
    <button className="btn-avatar" onClick={() => setShowLoginDialog(true)} title={userInfo.nickname}>
      <img src={userInfo.avatar} alt={userInfo.nickname} />
    </button>
  ) : (
    <button className="btn-login" onClick={handleLogin}>登录洛谷</button>
  )}
</div>
```

- [ ] **Step 5: 运行类型检查并提交**

Run: `npm run typecheck`  
Expected: PASS

```bash
git add src/renderer/src/hooks/useApi.ts src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/components/ImportDialog.tsx src/renderer/src/components/CreateTrainingDialog.tsx src/renderer/src/App.css
git commit -m "feat: add grouped sidebar and manual training dialog"
```

### Task 5: 接入自定义题单的加题、删题和多平台链接展示

**Files:**
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\types.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\hooks\useApi.ts`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.tsx`
- Create: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\CreateProblemDialog.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ProblemList.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\components\ProblemItem.tsx`
- Modify: `D:\ryuuko\ACM-Template\luogu-tracker\src\renderer\src\App.css`

- [ ] **Step 1: 写失败测试，锁定空分类与链接展示规则**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleProblemTags } from './problemTags'

test('手动题目初始标签应沿用输入标签作为原始标签来源', () => {
  assert.deepEqual(
    buildVisibleProblemTags({
      completed: true,
      originalTags: ['构造'],
      userTags: [],
      hiddenOriginalTags: [],
    }),
    ['构造'],
  )
})
```

- [ ] **Step 2: 运行相关前端纯逻辑测试，确认基线通过**

Run: `npx tsc -p tsconfig.test.json && node --test .tmp-test/dist/renderer/src/problemTags.test.js`  
Expected: PASS

- [ ] **Step 3: 扩展 `useApi.ts` 与 `App.tsx` 的加题/删题状态流**

```ts
const createProblem = useCallback(async (payload: {
  trainingId: number
  platform: string
  problemKey: string
  title: string
  url: string
  difficulty: number
  tags: string[]
}) => {
  await window.api.createProblem(payload)
  await Promise.all([fetchProblems(payload.trainingId), fetchTrainings()])
}, [fetchProblems, fetchTrainings])

const deleteProblem = useCallback(async (trainingId: number, problemId: number) => {
  await window.api.deleteProblem(problemId)
  await Promise.all([fetchProblems(trainingId), fetchTrainings()])
}, [fetchProblems, fetchTrainings])
```

```tsx
const selectedTraining = trainings.find(training => training.id === selectedTrainingId) ?? null
const [showCreateProblem, setShowCreateProblem] = useState(false)
const [pendingDeleteProblemId, setPendingDeleteProblemId] = useState<number | null>(null)

const canEditProblems = selectedTraining?.sourceType === 'manual'
```

- [ ] **Step 4: 改造题目列表与题目项**

```tsx
function handleOpenProblem(problem: Problem) {
  if (problem.url.trim()) {
    window.api.openUrl(problem.url)
    return
  }

  if (problem.platform === 'Luogu') {
    window.api.openUrl(`https://www.luogu.com.cn/problem/${problem.problemKey}`)
  }
}
```

```tsx
<ProblemList
  problems={selectedTrainingId ? problems : []}
  trainingId={selectedTrainingId}
  allTags={allTags}
  trainingSourceType={selectedTraining?.sourceType ?? null}
  onCreateProblem={() => setShowCreateProblem(true)}
  onDeleteProblem={problemId => setPendingDeleteProblemId(problemId)}
  onToggle={toggleProblem}
  onUpdateNote={updateNote}
  onUpdateTags={updateProblemTags}
  onLoadTagCatalog={getTagCatalog}
  onRefreshTagCatalog={refreshTagCatalog}
/>
```

```tsx
{totalCount === 0 && trainingSourceType === 'manual' ? (
  <div className="problem-empty">
    <div>当前题单暂无题目</div>
    <button className="btn-primary" onClick={onCreateProblem}>添加题目</button>
  </div>
) : totalCount === 0 ? (
  <div className="problem-empty">请从左侧选择一个题单</div>
) : null}
```

```tsx
{canDelete && (
  <button
    className="btn-delete-problem"
    onClick={event => {
      event.stopPropagation()
      onDelete(problem.id)
    }}
    title="删除题目"
  >
    删除
  </button>
)}
```

- [ ] **Step 5: 补添加题目弹窗、删除确认与提交**

```tsx
export default function CreateProblemDialog({ visible, onCreate, onClose }: Props) {
  const [platform, setPlatform] = useState('')
  const [problemKey, setProblemKey] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [difficulty, setDifficulty] = useState('-1')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!platform.trim() || !problemKey.trim() || !title.trim()) {
      setError('请填写平台、题号和标题')
      return
    }

    await onCreate({
      platform: platform.trim(),
      problemKey: problemKey.trim(),
      title: title.trim(),
      url: url.trim(),
      difficulty: Number(difficulty),
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
    })
  }
}
```

Run: `npm run typecheck`  
Expected: PASS

```bash
git add src/renderer/src/types.ts src/renderer/src/hooks/useApi.ts src/renderer/src/App.tsx src/renderer/src/components/CreateProblemDialog.tsx src/renderer/src/components/ProblemList.tsx src/renderer/src/components/ProblemItem.tsx src/renderer/src/App.css
git commit -m "feat: support manual training problem management"
```

### Task 6: 全量验证与收尾

**Files:**
- No file changes

- [ ] **Step 1: 运行完整类型检查**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 2: 运行完整自动化测试**

Run: `npm test`  
Expected: PASS，`trainingStore.test`、`trainingGroups.test` 与现有测试全部通过

- [ ] **Step 3: 运行构建验证**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 4: 手动验证题单归组与自定义题单流程**

Run: `npm run dev`  
Expected:
- 历史题单显示在 `导入题单 -> 未分类`
- 导入时填写分类后，新题单进入对应导入分类
- 可以新建自定义题单并自动选中
- 空自定义题单显示“添加题目”入口
- 添加 `Codeforces` 或任意平台题目后能正常显示
- 删除自定义题单中的题目后数量和进度回退正确
- 导入题单中没有添加题目和删除题目入口

- [ ] **Step 5: 最终提交**

```bash
git status --short
git add src/main/trainingStore.ts src/main/trainingStore.test.ts src/main/db.ts src/main/ipc.ts src/preload/index.ts tsconfig.test.json src/renderer/src/types.ts src/renderer/src/trainingGroups.ts src/renderer/src/trainingGroups.test.ts src/renderer/src/hooks/useApi.ts src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/components/ImportDialog.tsx src/renderer/src/components/CreateTrainingDialog.tsx src/renderer/src/components/CreateProblemDialog.tsx src/renderer/src/components/ProblemList.tsx src/renderer/src/components/ProblemItem.tsx src/renderer/src/App.css
git commit -m "feat: add manual trainings and grouped categories"
```

## Self-Review

- Spec coverage:
  - `导入题单 / 自定义题单` 分层：Task 3、Task 4
  - 自定义分类：Task 2、Task 3、Task 4
  - 新建空题单：Task 1、Task 2、Task 4
  - 自定义题单手动增删题：Task 1、Task 2、Task 5
  - 导入题单只读：Task 1、Task 2、Task 5
  - 旧数据迁移：Task 1、Task 2
  - 回归验证：Task 6
- Placeholder scan:
  - 已去掉 `TODO` / `TBD` 风格占位，所有任务都给出文件、命令和代码骨架。
- Type consistency:
  - 统一使用 `sourceType`（前端）/ `source_type`（数据库）
  - 统一使用 `problemKey`（前端/IPC）/ `problem_key`（数据库）
  - 统一使用 `manual` / `imported` 作为来源枚举值
