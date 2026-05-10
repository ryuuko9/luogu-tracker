export interface ContentNodeLike {
  isLeaf?: boolean
  isText?: boolean
  text?: string | null
  childCount?: number
  child?: (index: number) => ContentNodeLike
}

export interface TableDimensions {
  rows: number
  cols: number
}

export function hasMeaningfulContent(node: ContentNodeLike | null | undefined): boolean {
  if (!node) return false
  if (node.isText) return (node.text ?? '').trim().length > 0
  if (node.isLeaf) return true

  const childCount = node.childCount ?? 0
  if (childCount === 0 || !node.child) return false

  for (let i = 0; i < childCount; i++) {
    if (hasMeaningfulContent(node.child(i))) return true
  }

  return false
}

export function normalizeEditorMarkdown(markdown: string): string {
  return markdown
    // 移除 Milkdown 为保留空段落插入的独立 <br /> 占位行。
    .replace(/^[ \t]*<br\s*\/?>[ \t]*\r?\n?/gm, '')
    .replace(/\n+$/, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function parseTableDimensions(
  rowsInput: string,
  colsInput: string,
): TableDimensions | string {
  const rowsText = rowsInput.trim()
  const colsText = colsInput.trim()

  if (!rowsText) return '请输入表格行数'
  if (!colsText) return '请输入表格列数'

  if (!/^\d+$/.test(rowsText) || Number(rowsText) <= 0) {
    return '表格行数必须是正整数'
  }

  if (!/^\d+$/.test(colsText) || Number(colsText) <= 0) {
    return '表格列数必须是正整数'
  }

  return {
    rows: Number(rowsText),
    cols: Number(colsText),
  }
}
