import { ipcMain, shell, Session } from 'electron'
import * as db from './db'
import { fetchKnowledgeTagCatalog, scrapeTraining } from './scraper'
import { openLoginWindow, getLoginStatus, logout } from './luoguAuth'

function parseTagList(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(tag => String(tag).trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function mergeVisibleTags(
  completed: boolean,
  originalTags: string[],
  userTags: string[],
  hiddenOriginalTags: string[],
): string[] {
  if (!completed) return []

  const originalSet = new Set(originalTags)
  const hiddenSet = new Set(hiddenOriginalTags)
  const merged = originalTags.filter(tag => !hiddenSet.has(tag))
  for (const tag of userTags) {
    if (originalSet.has(tag)) continue
    if (!merged.includes(tag)) {
      merged.push(tag)
    }
  }
  return merged
}

function mapProblemRow(row: Record<string, unknown>) {
  const completed = Number(row.completed ?? 0) === 1
  const originalTags = parseTagList(row.original_tags ?? row.tags)
  const userTags = parseTagList(row.user_tags)
  const hiddenOriginalTags = parseTagList(row.hidden_original_tags)

  return {
    id: Number(row.id),
    trainingId: Number(row.training_id),
    pid: String(row.pid ?? ''),
    title: String(row.title ?? ''),
    difficulty: Number(row.difficulty ?? -1),
    originalTags,
    userTags,
    hiddenOriginalTags,
    tags: mergeVisibleTags(completed, originalTags, userTags, hiddenOriginalTags),
    completed,
    note: String(row.note ?? '')
  }
}

export function registerIpcHandlers(luoguSession: Session): void {
  // === 登录 ===
  ipcMain.handle('login', async () => {
    return openLoginWindow(luoguSession)
  })

  // === 获取登录状态 ===
  ipcMain.handle('get-login-status', async () => {
    return getLoginStatus(luoguSession)
  })

  // === 退出登录 ===
  ipcMain.handle('logout', async () => {
    await logout(luoguSession)
  })

  // === 导入题单 ===
  ipcMain.handle('import-training', async (_event, input: string) => {
    const loginStatus = await getLoginStatus(luoguSession)
    const data = await scrapeTraining(input, luoguSession, Boolean(loginStatus))

    db.insertTraining(
      data.training.id,
      data.training.name,
      data.training.description,
      data.training.problemCount
    )

    for (const p of data.problems) {
      db.insertProblem(
        data.training.id,
        p.pid,
        p.title,
        p.difficulty,
        JSON.stringify(p.tags)
      )
    }

    return {
      id: data.training.id,
      name: data.training.name,
      description: data.training.description,
      problemCount: data.training.problemCount,
      createdAt: new Date().toISOString()
    }
  })

  // === 获取所有题单 ===
  ipcMain.handle('get-trainings', () => {
    const rows = db.getAllTrainings()
    return rows.map(r => ({
      id: Number(r.id),
      name: String(r.name ?? ''),
      description: String(r.description ?? ''),
      problemCount: Number(r.problem_count ?? 0),
      createdAt: String(r.created_at ?? ''),
      completedCount: db.getCompletedCount(Number(r.id))
    }))
  })

  // === 删除题单 ===
  ipcMain.handle('delete-training', (_event, id: number) => {
    db.deleteTraining(id)
  })

  // === 获取题单下的题目 ===
  ipcMain.handle('get-problems', (_event, trainingId: number) => {
    const rows = db.getProblemsByTraining(trainingId)
    return rows.map(mapProblemRow)
  })

  // === 切换题目完成状态 ===
  ipcMain.handle('toggle-problem', (_event, id: number) => {
    const newVal = db.toggleProblemCompleted(id)
    return newVal === 1
  })

  // === 更新心得 ===
  ipcMain.handle('update-note', (_event, id: number, note: string) => {
    db.updateProblemNote(id, note)
  })

  // === 更新题目标签 ===
  ipcMain.handle('update-problem-tags', (_event, id: number, userTags: string[], hiddenOriginalTags: string[]) => {
    db.updateProblemTags(id, JSON.stringify(userTags), JSON.stringify(hiddenOriginalTags))
  })

  // === 获取所有标签 ===
  ipcMain.handle('get-all-tags', () => {
    return db.getAllTags()
  })

  // === 获取本地标签全集 ===
  ipcMain.handle('get-tag-catalog', () => {
    return db.getTagCatalog()
  })

  // === 刷新本地标签全集 ===
  ipcMain.handle('refresh-tag-catalog', async () => {
    const tags = await fetchKnowledgeTagCatalog()
    const nextCatalog = db.replaceTagCatalog(tags.map(tag => tag.name))
    db.sanitizeProblemKnowledgeTags(nextCatalog.tags)
    return nextCatalog
  })

  // === 打开外部链接 ===
  ipcMain.handle('open-url', (_event, url: string) => {
    shell.openExternal(url)
  })
}
