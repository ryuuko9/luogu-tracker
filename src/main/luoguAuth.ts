import type { BrowserWindow, Session } from 'electron'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
let loginWindow: BrowserWindow | null = null
let loginWindowTask: Promise<UserInfo | null> | null = null

function getElectronModule(): typeof import('electron') {
  return require('electron') as typeof import('electron')
}

function extractContext(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="lentille-context" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as Record<string, unknown>
  } catch {
    return null
  }
}

interface LoginErrorData {
  errorCode?: number
  errorData?: { needLogin?: number }
}

// 从 HTML 中检测是否需要登录
export function isNeedLogin(html: string): boolean {
  const ctx = extractContext(html)
  if (!ctx) return false
  const data = ctx.data as LoginErrorData | undefined
  if (!data) return false
  return data.errorCode === 401 || data.errorData?.needLogin === 1
}

interface UserPageData {
  user?: {
    uid?: number
    name?: string
    avatar?: string
  }
}

export interface UserInfo {
  nickname: string
  avatar: string
}

interface LoginIdentity extends UserInfo {
  uid: string
}

// 从用户页 HTML 中解析用户信息
export function parseUserInfo(html: string): UserInfo | null {
  const ctx = extractContext(html)
  if (!ctx) return null
  const data = ctx.data as UserPageData | undefined
  if (!data?.user?.name) return null
  return {
    nickname: data.user.name,
    avatar: data.user.avatar || ''
  }
}

// 从 cookies 中提取 _uid
export function extractUid(cookies: Array<{ name: string; value: string }>): string | null {
  for (const cookie of cookies) {
    if (cookie.name === '_uid') return cookie.value
  }
  return null
}

export function buildCookieRemovalUrl(cookie: {
  secure?: boolean
  domain?: string
  path?: string
}): string {
  const protocol = cookie.secure ? 'https' : 'http'
  const host = (cookie.domain || 'www.luogu.com.cn').replace(/^\.+/, '')
  const path = cookie.path || '/'
  return `${protocol}://${host}${path}`
}

export function shouldAutoCloseLoginWindow(initialUid: string | null, currentUid: string | null): boolean {
  if (!currentUid) return false
  if (!initialUid) return true
  return initialUid !== currentUid
}

async function getLoginIdentity(session: Session): Promise<LoginIdentity | null> {
  const cookies = await session.cookies.get({})
  const uid = extractUid(cookies)
  if (!uid) return null

  const resp = await session.fetch('https://www.luogu.com.cn/user/setting', {
    headers: { 'User-Agent': UA }
  })
  if (resp.status === 401) return null

  const html = await resp.text()
  if (isNeedLogin(html)) return null

  const userResp = await session.fetch(`https://www.luogu.com.cn/user/${uid}`, {
    headers: { 'User-Agent': UA }
  })
  const userHtml = await userResp.text()
  const userInfo = parseUserInfo(userHtml)

  return userInfo
    ? { uid, nickname: userInfo.nickname, avatar: userInfo.avatar }
    : { uid, nickname: `用户${uid}`, avatar: '' }
}

// 打开洛谷登录窗口
export async function openLoginWindow(session: Session): Promise<UserInfo | null> {
  if (loginWindow && !loginWindow.isDestroyed() && loginWindowTask) {
    loginWindow.focus()
    return loginWindowTask
  }

  const initialIdentity = await getLoginIdentity(session)
  const { BrowserWindow } = getElectronModule()
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    title: '洛谷登录',
    webPreferences: {
      session,
      sandbox: false
    }
  })
  loginWindow = win

  const closeWatcher = async (): Promise<void> => {
    const currentIdentity = await getLoginIdentity(session)
    if (shouldAutoCloseLoginWindow(initialIdentity?.uid ?? null, currentIdentity?.uid ?? null)) {
      if (!win.isDestroyed()) win.close()
    }
  }

  const result = new Promise<UserInfo | null>((resolve) => {
    let settled = false

    const finalize = async () => {
      if (settled) return
      settled = true
      const currentIdentity = await getLoginIdentity(session)
      resolve(currentIdentity ? {
        nickname: currentIdentity.nickname,
        avatar: currentIdentity.avatar
      } : null)
    }

    win.on('closed', () => {
      void finalize()
    })
  })

  const wrappedResult = result.finally(() => {
    if (loginWindow === win) {
      loginWindow = null
    }
    if (loginWindowTask === wrappedResult) {
      loginWindowTask = null
    }
  })
  loginWindowTask = wrappedResult

  win.webContents.on('did-navigate', () => {
    void closeWatcher()
  })
  win.webContents.on('did-redirect-navigation', () => {
    void closeWatcher()
  })
  win.loadURL('https://www.luogu.com.cn/auth/login')

  return wrappedResult
}

// 获取登录状态，返回用户信息或 null
export async function getLoginStatus(session: Session): Promise<UserInfo | null> {
  const identity = await getLoginIdentity(session)
  return identity ? {
    nickname: identity.nickname,
    avatar: identity.avatar
  } : null
}

// 退出登录，清除会话数据
export async function logout(session: Session): Promise<void> {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close()
  }
  const cookies = await session.cookies.get({})
  for (const cookie of cookies) {
    const url = buildCookieRemovalUrl(cookie)
    await session.cookies.remove(url, cookie.name)
  }
  await session.clearStorageData()
}
