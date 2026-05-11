import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterKnowledgeTagInfos,
  mapKnowledgeProblemTags,
  normalizeKnowledgeTagNames,
} from './knowledgeTags'

test('仅保留 type = 2 的知识点标签', () => {
  const tags = filterKnowledgeTagInfos([
    { id: 1, name: '模拟', type: 2, parent: 110 },
    { id: 46, name: 'USACO', type: 3, parent: 428 },
    { id: 14, name: '2007', type: 4, parent: null },
    { id: 103, name: '交互题', type: 5, parent: null },
  ])

  assert.deepEqual(tags.map(tag => tag.name), ['模拟'])
})

test('题目标签映射时应过滤非知识点标签并去重', () => {
  const tagMap = new Map<number, string>([
    [1, '模拟'],
    [3, '动态规划 DP'],
  ])

  assert.deepEqual(
    mapKnowledgeProblemTags([1, 46, 3, 1, 999], tagMap),
    ['模拟', '动态规划 DP']
  )
})

test('清洗本地标签时应过滤非法标签并保持顺序', () => {
  const allowedTags = new Set(['模拟', '动态规划 DP', '贪心'])

  assert.deepEqual(
    normalizeKnowledgeTagNames([' 模拟 ', 'USACO', '模拟', '贪心', '', '交互题'], allowedTags),
    ['模拟', '贪心']
  )
})
