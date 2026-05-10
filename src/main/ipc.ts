import { ipcMain, shell, Session } from 'electron'
import * as db from './db'
import { scrapeTraining } from './scraper'
import { openLoginWindow, getLoginStatus, logout } from './luoguAuth'

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
    return rows.map(r => ({
      id: Number(r.id),
      trainingId: Number(r.training_id),
      pid: String(r.pid ?? ''),
      title: String(r.title ?? ''),
      difficulty: Number(r.difficulty ?? -1),
      tags: JSON.parse(String(r.tags ?? '[]')) as string[],
      completed: Number(r.completed ?? 0) === 1,
      note: String(r.note ?? '')
    }))
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

  // === 获取所有标签 ===
  ipcMain.handle('get-all-tags', () => {
    return db.getAllTags()
  })

  // === 打开外部链接 ===
  ipcMain.handle('open-url', (_event, url: string) => {
    shell.openExternal(url)
  })
}
