export interface LuoguTagInfo {
  id: number
  name: string
  type: number
  parent: number | null
}

export const KNOWLEDGE_TAG_TYPE = 2

export function isKnowledgeTag(tag: Pick<LuoguTagInfo, 'type'>): boolean {
  return tag.type === KNOWLEDGE_TAG_TYPE
}

export function filterKnowledgeTagInfos(tags: LuoguTagInfo[]): LuoguTagInfo[] {
  return tags.filter(isKnowledgeTag)
}

export function normalizeKnowledgeTagNames(tags: string[], allowedTags?: ReadonlySet<string>): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawTag of tags) {
    const tag = String(rawTag).trim()
    if (!tag || seen.has(tag)) continue
    if (allowedTags && !allowedTags.has(tag)) continue
    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}

export function mapKnowledgeProblemTags(tagIds: number[], tagMap: ReadonlyMap<number, string>): string[] {
  const mapped: string[] = []
  const seen = new Set<string>()

  for (const tagId of tagIds) {
    const tagName = tagMap.get(tagId)
    if (!tagName || seen.has(tagName)) continue
    seen.add(tagName)
    mapped.push(tagName)
  }

  return mapped
}
