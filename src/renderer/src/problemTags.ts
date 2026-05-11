export interface ProblemTagState {
  completed: boolean
  originalTags: string[]
  userTags: string[]
  hiddenOriginalTags: string[]
}

function normalizeTag(tag: string): string {
  return tag.trim()
}

export function normalizeTagList(tags: string[]): string[] {
  const deduped = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeTag(tag)
    if (!normalized) continue
    deduped.add(normalized)
  }
  return [...deduped]
}

export function mergeProblemTags(
  originalTags: string[],
  hiddenOriginalTags: string[],
  userTags: string[],
): string[] {
  const normalizedOriginalTags = normalizeTagList(originalTags)
  const hiddenSet = new Set(normalizeTagList(hiddenOriginalTags))
  const originalSet = new Set(normalizedOriginalTags)
  const merged = normalizedOriginalTags.filter(tag => !hiddenSet.has(tag))

  for (const tag of normalizeTagList(userTags)) {
    if (originalSet.has(tag)) continue
    if (!merged.includes(tag)) {
      merged.push(tag)
    }
  }

  return merged
}

export function buildVisibleProblemTags(state: ProblemTagState): string[] {
  if (!state.completed) return []
  return mergeProblemTags(state.originalTags, state.hiddenOriginalTags, state.userTags)
}
