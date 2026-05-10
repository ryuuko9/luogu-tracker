import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hasMeaningfulContent,
  normalizeEditorMarkdown,
  parseTableDimensions,
  type ContentNodeLike,
} from './NoteEditor.utils'

function createNode(node: Partial<ContentNodeLike> = {}, children: ContentNodeLike[] = []): ContentNodeLike {
  return {
    isText: false,
    text: '',
    childCount: children.length,
    child: (index: number) => children[index],
    ...node,
  }
}

test('空内容不应被视为有效内容', () => {
  assert.equal(hasMeaningfulContent(createNode()), false)
})

test('仅包含空白字符的文本内容不应被保留', () => {
  const root = createNode({}, [
    createNode({ isText: true, text: ' ' }),
    createNode({ isText: true, text: '\n\t' }),
  ])

  assert.equal(hasMeaningfulContent(root), false)
})

test('包含非空白文本时应保留原内容', () => {
  const root = createNode({}, [
    createNode({ isText: true, text: '标题' }),
  ])

  assert.equal(hasMeaningfulContent(root), true)
})

test('非文本叶子节点也应视为有效内容', () => {
  const root = createNode({}, [
    createNode({ isLeaf: true, childCount: 0 }),
  ])

  assert.equal(hasMeaningfulContent(root), true)
})

test('应移除独占一行的 <br /> 占位', () => {
  const markdown = '# 标题\n\n<br />\n\n下一段\n'

  assert.equal(normalizeEditorMarkdown(markdown), '# 标题\n\n下一段\n')
})

test('不应移除正文中的内联 <br />', () => {
  const markdown = '第一行 <br /> 第二行\n'

  assert.equal(normalizeEditorMarkdown(markdown), markdown)
})

test('应正确解析合法的表格行列输入', () => {
  assert.deepEqual(parseTableDimensions('3', '5'), { rows: 3, cols: 5 })
  assert.deepEqual(parseTableDimensions(' 2 ', ' 4 '), { rows: 2, cols: 4 })
})

test('表格行列为空时应返回对应错误', () => {
  assert.equal(parseTableDimensions('', '3'), '请输入表格行数')
  assert.equal(parseTableDimensions('3', ''), '请输入表格列数')
})

test('表格行列不是正整数时应返回错误', () => {
  assert.equal(parseTableDimensions('0', '3'), '表格行数必须是正整数')
  assert.equal(parseTableDimensions('-1', '3'), '表格行数必须是正整数')
  assert.equal(parseTableDimensions('2.5', '3'), '表格行数必须是正整数')
  assert.equal(parseTableDimensions('3', '0'), '表格列数必须是正整数')
  assert.equal(parseTableDimensions('3', '1.5'), '表格列数必须是正整数')
})
