import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleProblemTags, mergeProblemTags } from './problemTags'

test('未完成题不应显示任何知识点标签', () => {
  assert.deepEqual(
    buildVisibleProblemTags({
      completed: false,
      originalTags: ['图论', '最短路'],
      userTags: ['构造'],
      hiddenOriginalTags: [],
    }),
    [],
  )
})

test('已完成题应按原始标签减隐藏标签再追加用户标签', () => {
  assert.deepEqual(
    buildVisibleProblemTags({
      completed: true,
      originalTags: ['图论', '最短路', '贪心'],
      userTags: ['构造', '最短路'],
      hiddenOriginalTags: ['最短路'],
    }),
    ['图论', '贪心', '构造'],
  )
})

test('合并标签时应去重并保留原始标签顺序', () => {
  assert.deepEqual(
    mergeProblemTags(
      ['二分', '图论', '构造'],
      ['图论'],
      ['构造', '思维'],
    ),
    ['二分', '构造', '思维'],
  )
})
