import { app, BrowserWindow, session } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc'

const userDataPath = resolve(__dirname, '../../.userdata')
if (!existsSync(userDataPath)) {
  mkdirSync(userDataPath, { recursive: true })
}
app.setPath('userData', userDataPath)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '洛谷题单管理',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await initDatabase()
  const luoguSession = session.fromPartition('persist:luogu-auth')
  registerIpcHandlers(luoguSession)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
