export interface Training {
  id: number
  name: string
  description: string
  problemCount: number
  createdAt: string
  completedCount: number
}

export interface Problem {
  id: number
  trainingId: number
  pid: string
  title: string
  difficulty: number
  tags: string[]
  originalTags: string[]
  userTags: string[]
  hiddenOriginalTags: string[]
  completed: boolean
  note: string
}

export interface UserInfo {
  nickname: string
  avatar: string
}

export interface TagCatalogState {
  tags: string[]
  updatedAt: string | null
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  [-1]: '未评定',
  1: '入门',
  2: '普及-',
  3: '普及/提高-',
  4: '普及+/提高',
  5: '提高+/省选-',
  6: '省选/NOI-',
  7: 'NOI/NOI+/CTSC',
  8: 'NOI/NOI+/CTSC',
  9: 'NOI/NOI+/CTSC'
}

// 洛谷难度配色（与 luogu.com.cn 一致）
export const DIFFICULTY_COLORS: Record<number, string> = {
  [-1]: '#bcbcbc',  // 未评定 — 灰色
  1: '#fe4c61',     // 入门 — 红色
  2: '#f39c11',     // 普及- — 橙色
  3: '#ffc116',     // 普及/提高- — 黄色
  4: '#52c41a',     // 普及+/提高 — 绿色
  5: '#1e90ff',     // 提高+/省选- — 蓝色
  6: '#9d3dcf',     // 省选/NOI- — 紫色
  7: '#0e1d6f',     // NOI/NOI+/CTSC — 深蓝
  8: '#0e1d6f',     // NOI/NOI+/CTSC — 深蓝
  9: '#0e1d6f'      // NOI/NOI+/CTSC — 深蓝
}
