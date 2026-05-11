import { contextBridge, ipcRenderer } from 'electron'

const api = {
  importTraining: (input: string) => ipcRenderer.invoke('import-training', input) as Promise<{
    id: number; name: string; description: string; problemCount: number; createdAt: string
  }>,

  getTrainings: () => ipcRenderer.invoke('get-trainings') as Promise<Array<{
    id: number; name: string; description: string; problemCount: number; createdAt: string; completedCount: number
  }>>,

  deleteTraining: (id: number) => ipcRenderer.invoke('delete-training', id) as Promise<void>,

  getProblems: (trainingId: number) => ipcRenderer.invoke('get-problems', trainingId) as Promise<Array<{
    id: number; trainingId: number; pid: string; title: string; difficulty: number;
    tags: string[]; originalTags: string[]; userTags: string[]; hiddenOriginalTags: string[];
    completed: boolean; note: string
  }>>,

  toggleProblem: (id: number) => ipcRenderer.invoke('toggle-problem', id) as Promise<boolean>,

  updateNote: (id: number, note: string) => ipcRenderer.invoke('update-note', id, note) as Promise<void>,

  updateProblemTags: (id: number, userTags: string[], hiddenOriginalTags: string[]) =>
    ipcRenderer.invoke('update-problem-tags', id, userTags, hiddenOriginalTags) as Promise<void>,

  getAllTags: () => ipcRenderer.invoke('get-all-tags') as Promise<string[]>,

  getTagCatalog: () => ipcRenderer.invoke('get-tag-catalog') as Promise<{
    tags: string[]
    updatedAt: string | null
  }>,

  refreshTagCatalog: () => ipcRenderer.invoke('refresh-tag-catalog') as Promise<{
    tags: string[]
    updatedAt: string | null
  }>,

  login: () => ipcRenderer.invoke('login') as Promise<{
    nickname: string; avatar: string
  } | null>,

  getLoginStatus: () => ipcRenderer.invoke('get-login-status') as Promise<{
    nickname: string; avatar: string
  } | null>,

  logout: () => ipcRenderer.invoke('logout') as Promise<void>,

  openUrl: (url: string) => ipcRenderer.invoke('open-url', url) as Promise<void>
}

contextBridge.exposeInMainWorld('api', api)

export type LuoguTrackerAPI = typeof api
