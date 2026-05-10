import type { LuoguTrackerAPI } from './index'

declare global {
  interface Window {
    api: LuoguTrackerAPI
  }
}

export {}
