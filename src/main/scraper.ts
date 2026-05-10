import type { Session } from 'electron'

const BASE_URL = 'https://www.luogu.com.cn'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function getElectronNet(): typeof import('electron').net {
  return (require('electron') as typeof import('electron')).net
}

interface RawProblem {
  pid: string
  title: string
  difficulty: number
  tags: number[]
}

interface RawTraining {
  id: number
  name: string
  description: string
  problems: RawProblem[]
  problemCount: number
}

interface TagInfo {
  id: number
  name: string
}

export interface ScrapedData {
  training: {
    id: number
    name: string
    description: string
    problemCount: number
  }
  problems: Array<{
    pid: string
    title: string
    difficulty: number
    tags: string[]
  }>
}

interface ErrorPayload {
  errorCode?: number
  errorMessage?: string
  errorData?: {
    needLogin?: number
  }
}

export function parseTrainingId(input: string): number | null {
  const normalized = input.trim()

  if (/^\d+$/.test(normalized)) {
    return parseInt(normalized, 10)
  }

  const directMatch = normalized.match(/luogu\.com(?:\.cn)?\/training\/(\d+)/)
  if (directMatch) return parseInt(directMatch[1], 10)

  const queryMatch = normalized.match(/[?&]trainingId=(\d+)/i)
  if (queryMatch) return parseInt(queryMatch[1], 10)

  return null
}

// 获取页面 HTML（使用 net 或 session）
async function fetchPage(url: string, session?: Session): Promise<string> {
  if (session) {
    const resp = await session.fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow'
    })
    return resp.text()
  }

  // 无 session 时的旧逻辑（公开题单可工作）
  const resp = await getElectronNet().fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow'
  })
  return resp.text()
}

// 获取标签映射
async function fetchTagMap(): Promise<Map<number, string>> {
  const tagMap = new Map<number, string>()
  try {
    const resp = await getElectronNet().fetch(`${BASE_URL}/_lfe/tags/zh-CN`, {
      headers: { 'User-Agent': UA }
    })
    const data = await resp.json() as { tags: TagInfo[] }
    for (const tag of data.tags) {
      tagMap.set(tag.id, tag.name)
    }
  } catch {
    // 标签获取失败不影响主流程
  }
  return tagMap
}

// 从 HTML 中提取 lentille-context JSON
export function extractContext(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="lentille-context" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as Record<string, unknown>
  } catch {
    return null
  }
}

export function extractTrainingPayload(context: Record<string, unknown>, id: number, hasCredential: boolean): RawTraining {
  const data = context.data as ({ training?: RawTraining } & ErrorPayload) | undefined
  if (data?.training) {
    return data.training
  }

  if (data?.errorCode === 401 || data?.errorData?.needLogin === 1) {
    if (hasCredential) {
      throw new Error('当前洛谷登录状态已失效，请重新登录')
    }
    throw new Error('该题单需要登录后访问，请先登录洛谷')
  }

  if (typeof data?.errorMessage === 'string' && data.errorMessage.trim()) {
    throw new Error(`题单 ${id} 无法访问：${data.errorMessage}`)
  }

  console.error('[scraper] context.data 结构:', JSON.stringify(context.data).substring(0, 300))
  throw new Error(`题单 ${id} 数据结构异常：缺少 training 字段`)
}

export async function scrapeTraining(input: string, session?: Session, hasCredential = false): Promise<ScrapedData> {
  const id = parseTrainingId(input)
  if (id === null) {
    throw new Error('无法解析题单 ID，请输入正确的题单链接或数字 ID')
  }

  const [html, tagMap] = await Promise.all([
    fetchPage(`${BASE_URL}/training/${id}`, session),
    fetchTagMap()
  ])

  if (!html.includes('lentille-context')) {
    console.error('[scraper] 页面不含 lentille-context，HTML 前 500 字符:', html.substring(0, 500))
    throw new Error(`题单 ${id} 页面无法解析：未找到数据标签。可能原因：题单不存在、被限制访问、或触发反爬机制。`)
  }

  const context = extractContext(html)
  if (!context) {
    throw new Error(`题单 ${id} 数据 JSON 解析失败`)
  }

  const raw = extractTrainingPayload(context, id, hasCredential)

  return {
    training: {
      id: raw.id,
      name: raw.name,
      description: raw.description || '',
      problemCount: raw.problemCount
    },
    problems: raw.problems.map(p => ({
      pid: p.pid,
      title: p.title,
      difficulty: p.difficulty,
      tags: (p.tags || []).map(tid => tagMap.get(tid) || `标签${tid}`)
    }))
  }
}
