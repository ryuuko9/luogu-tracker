import { useRef, useCallback, useEffect, useState, memo } from 'react'
import { flushSync } from 'react-dom'
import { Crepe } from '@milkdown/crepe'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import type { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import type { EditorState } from '@milkdown/prose/state'
import {
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  headingSchema,
  hrSchema,
  paragraphSchema,
  selectTextNearPosCommand,
  setBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark'
import { createTable } from '@milkdown/kit/preset/gfm'
import { trailingConfig } from '@milkdown/plugin-trailing'
import type { EditorView } from '@milkdown/prose/view'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { hasMeaningfulContent, normalizeEditorMarkdown, parseTableDimensions } from './NoteEditor.utils'

// === 类型 ===
interface ContextMenuPos { x: number; y: number }
type EditorActionRunner = (handler: (ctx: Ctx) => void) => void

type MenuItem =
  | { type: 'action'; label: string; icon: string; action: (view: EditorView, runWithCtx?: EditorActionRunner | null) => void; repairView?: boolean }
  | { type: 'divider' }
  | { type: 'submenu'; label: string; items: MenuItem[] }

// === 操作函数 ===
function deleteSelection(view: EditorView) {
  const { state, dispatch } = view
  const { from, to } = state.selection
  if (from !== to) dispatch(state.tr.delete(from, to))
}

// 找到光标所在的顶层块节点位置
function findBlockPos(view: EditorView): { start: number; end: number; node: any } | null {
  const { state } = view
  const $pos = state.doc.resolve(state.selection.from)
  // 向上找到 doc 的直接子节点
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d)
    if (node.type.name === 'doc') continue
    // 检查父节点是否是 doc
    const parent = $pos.node(d - 1)
    if (parent && parent.type.name === 'doc') {
      const start = $pos.start(d)
      const end = $pos.end(d)
      return { start, end, node }
    }
  }
  return null
}

// 替换当前块（保留内容，用于标题/引用/列表）
function replaceBlock(
  view: EditorView,
  typeName: string,
  attrs?: Record<string, unknown>,
  options?: { dropWhitespaceOnlyContent?: boolean },
) {
  const { state, dispatch } = view
  const pos = findBlockPos(view)
  if (!pos) return
  const nodeType = state.schema.nodes[typeName]
  if (!nodeType) return
  const content = options?.dropWhitespaceOnlyContent && !hasMeaningfulContent(pos.node.content)
    ? undefined
    : pos.node.content
  const newNode = content ? nodeType.create(attrs, content) : (nodeType.createAndFill(attrs) ?? nodeType.create(attrs))
  if (newNode) dispatch(state.tr.replaceWith(pos.start, pos.end, newNode).scrollIntoView())
}

function insertNewBlockByName(view: EditorView, typeName: string, attrs?: Record<string, unknown>) {
  const { state, dispatch } = view
  const pos = findBlockPos(view)
  if (!pos) return
  const nodeType = state.schema.nodes[typeName]
  if (!nodeType) return
  const newNode = nodeType.createAndFill(attrs) ?? nodeType.create(attrs)
  if (newNode) dispatch(state.tr.replaceWith(pos.start, pos.end, newNode).scrollIntoView())
}

function createTableNode(view: EditorView, rowsCount: number, colsCount: number) {
  const { schema } = view.state
  const tableType = schema.nodes.table
  const headerRowType = schema.nodes.table_header_row
  const headerCellType = schema.nodes.table_header
  const rowType = schema.nodes.table_row
  const cellType = schema.nodes.table_cell

  if (!tableType || !headerRowType || !headerCellType || !rowType || !cellType) return null

  const rows = Array.from({ length: rowsCount }, (_, rowIndex) => {
    const cellFactory = rowIndex === 0 ? headerCellType : cellType
    const cells = Array.from({ length: colsCount }, () => cellFactory.createAndFill())
      .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell))

    if (cells.length !== colsCount) return null

    return rowIndex === 0
      ? headerRowType.create(null, cells)
      : rowType.create(null, cells)
  }).filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (rows.length !== rowsCount) return null

  return tableType.create(null, rows)
}

function runEditorCommand(
  view: EditorView,
  runWithCtx: EditorActionRunner | null | undefined,
  handler: (ctx: Ctx, from: number) => void,
) {
  if (!runWithCtx) return false
  const from = view.state.selection.from
  runWithCtx((ctx) => {
    const commands = ctx.get(commandsCtx)
    commands.call(clearTextInCurrentBlockCommand.key)
    handler(ctx, from)
  })
  return true
}

function setBlockTypeForEmptyBlock(
  view: EditorView,
  runWithCtx: EditorActionRunner | null | undefined,
  getNodeType: (ctx: Ctx) => unknown,
  attrs?: Record<string, unknown>,
) {
  return runEditorCommand(view, runWithCtx, (ctx) => {
    const commands = ctx.get(commandsCtx)
    commands.call(setBlockTypeCommand.key, {
      nodeType: getNodeType(ctx),
      ...(attrs ? { attrs } : {}),
    })
  })
}

function addBlockForEmptyBlock(
  view: EditorView,
  runWithCtx: EditorActionRunner | null | undefined,
  getNodeType: (ctx: Ctx) => unknown,
  attrs?: Record<string, unknown>,
  afterInsert?: (ctx: Ctx, from: number) => void,
) {
  return runEditorCommand(view, runWithCtx, (ctx, from) => {
    const commands = ctx.get(commandsCtx)
    commands.call(addBlockTypeCommand.key, {
      nodeType: getNodeType(ctx),
      ...(attrs ? { attrs } : {}),
    })
    afterInsert?.(ctx, from)
  })
}

function replaceBlockOrUseCommand(
  view: EditorView,
  runWithCtx: EditorActionRunner | null | undefined,
  typeName: string,
  attrs?: Record<string, unknown>,
  getNodeType?: (ctx: Ctx) => unknown,
) {
  const pos = findBlockPos(view)
  if (!pos) return
  if (!hasMeaningfulContent(pos.node.content) && getNodeType) {
    if (setBlockTypeForEmptyBlock(view, runWithCtx, getNodeType, attrs)) return
  }
  replaceBlock(view, typeName, attrs, { dropWhitespaceOnlyContent: true })
}

function insertTableBlock(
  view: EditorView,
  runWithCtx: EditorActionRunner | null | undefined,
  rowsCount: number,
  colsCount: number,
) {
  const pos = findBlockPos(view)
  if (!pos) return

  if (!hasMeaningfulContent(pos.node.content)) {
    if (addBlockForEmptyBlock(
      view,
      runWithCtx,
      (ctx) => createTable(ctx, rowsCount, colsCount),
      undefined,
      (ctx, from) => {
        const commands = ctx.get(commandsCtx)
        commands.call(selectTextNearPosCommand.key, { pos: from })
      },
    )) return
  }

  const tableNode = createTableNode(view, rowsCount, colsCount)
  if (!tableNode) return

  const { state, dispatch } = view
  dispatch(state.tr.replaceWith(pos.start, pos.end, tableNode).scrollIntoView())
}

// === 菜单定义 ===
function buildMenu(view: EditorView, onRequestTable: () => void): MenuItem[] {
  const nodes = Object.keys(view.state.schema.nodes)
  console.log('[ctx-menu] 可用节点类型:', nodes)
  // 动态检测可用的节点类型
  const findNode = (...candidates: string[]) => candidates.find(n => nodes.includes(n))

  const blockquoteType = findNode('blockquote')
  const olType = findNode('ordered_list', 'orderedList')
  const ulType = findNode('bullet_list', 'bulletList')
  const taskType = findNode('taskList', 'task_list_item', 'taskListItem')
  const hrType = findNode('horizontal_rule', 'horizontalRule', 'hr')
  const codeType = findNode('code_block', 'codeBlock', 'fencedCode')
  const mathType = findNode('math_block', 'mathBlock', 'latex')
  const tableType = findNode('table')

  return [
    { type: 'action', label: '剪切', icon: '✂', action: (v) => document.execCommand('cut') },
    { type: 'action', label: '复制', icon: '⎘', action: (v) => document.execCommand('copy') },
    { type: 'action', label: '粘贴', icon: '📋', action: async (v) => {
      try { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t) } catch {}
    }},
    { type: 'action', label: '删除', icon: '🗑', action: deleteSelection },
    { type: 'divider' },
    ...(blockquoteType ? [{ type: 'action' as const, label: '引用', icon: '❝', action: (v: EditorView) => replaceBlock(v, blockquoteType) }] : []),
    ...(olType ? [{ type: 'action' as const, label: '有序列表', icon: '1.', action: (v: EditorView) => replaceBlock(v, olType) }] : []),
    ...(ulType ? [{ type: 'action' as const, label: '无序列表', icon: '•', action: (v: EditorView) => replaceBlock(v, ulType) }] : []),
    ...(taskType ? [{ type: 'action' as const, label: '任务列表', icon: '☑', action: (v: EditorView) => replaceBlock(v, taskType) }] : []),
    { type: 'divider' },
    { type: 'action', label: '缩进', icon: '→', action: (v) => {
      const { state, dispatch } = v
      const $pos = state.doc.resolve(state.selection.from)
      dispatch(state.tr.insertText('  ', $pos.start($pos.depth || 1)))
    }},
    { type: 'action', label: '取消缩进', icon: '←', action: (v) => {
      const { state, dispatch } = v
      const $pos = state.doc.resolve(state.selection.from)
      const start = $pos.start($pos.depth || 1)
      if (state.doc.textBetween(start, start + 2, '') === '  ') dispatch(state.tr.delete(start, start + 2))
    }},
    { type: 'divider' },
    { type: 'submenu', label: '段落', items: [
      { type: 'action', label: '正文', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'paragraph', undefined, (ctx) => paragraphSchema.type(ctx)) },
      { type: 'action', label: '标题 1', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 1 }, (ctx) => headingSchema.type(ctx)) },
      { type: 'action', label: '标题 2', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 2 }, (ctx) => headingSchema.type(ctx)) },
      { type: 'action', label: '标题 3', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 3 }, (ctx) => headingSchema.type(ctx)) },
      { type: 'action', label: '标题 4', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 4 }, (ctx) => headingSchema.type(ctx)) },
      { type: 'action', label: '标题 5', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 5 }, (ctx) => headingSchema.type(ctx)) },
      { type: 'action', label: '标题 6', icon: '', action: (v, runWithCtx) => replaceBlockOrUseCommand(v, runWithCtx, 'heading', { level: 6 }, (ctx) => headingSchema.type(ctx)) },
      ...(hrType ? [{ type: 'action' as const, label: '分割线', icon: '', action: (v: EditorView, runWithCtx?: EditorActionRunner | null) => {
        if (addBlockForEmptyBlock(v, runWithCtx, (ctx) => hrSchema.type(ctx))) return
        insertNewBlockByName(v, hrType)
      } }] : []),
    ]},
    { type: 'submenu', label: '插入', items: [
      ...(codeType ? [{ type: 'action' as const, label: '代码块', icon: '', action: (v: EditorView, runWithCtx?: EditorActionRunner | null) => {
        if (setBlockTypeForEmptyBlock(v, runWithCtx, (ctx) => codeBlockSchema.type(ctx))) return
        insertNewBlockByName(v, codeType)
      } }] : []),
      ...(mathType || codeType ? [{ type: 'action' as const, label: '数学公式', icon: '', action: (v: EditorView, runWithCtx?: EditorActionRunner | null) => {
        if (addBlockForEmptyBlock(v, runWithCtx, (ctx) => codeBlockSchema.type(ctx), { language: 'LaTeX' })) return
        insertNewBlockByName(v, codeType ?? mathType!, { language: 'LaTeX' })
      } }] : []),
      ...(tableType ? [{ type: 'action' as const, label: '表格', icon: '', repairView: false, action: () => onRequestTable() }] : []),
    ]},
  ]
}

// === 子菜单组件 ===
function SubmenuItemComponent({ item, onAction }: { item: Extract<MenuItem, {type:'submenu'}>; onAction: (fn: (view: EditorView, runWithCtx?: EditorActionRunner | null) => void, options?: { repairView?: boolean }) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="ctx-submenu-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="ctx-menu-row">
        <span>{item.label}</span>
        <span className="ctx-menu-row-arrow">›</span>
      </div>
      {open && (
        <div className="ctx-submenu-panel">
          {item.items.map((sub, j) => (
            sub.type === 'action' && (
              <button
                key={j}
                className="ctx-submenu-item"
                onClick={() => onAction(sub.action, sub.repairView === false ? undefined : { repairView: true })}
              >
                {sub.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// === 编辑器内部 ===
// key 变化时整个组件重新挂载，确保源码→WYSIWYG 切换时编辑器内容更新
function EditorInner({ markdown, onMarkdownUpdate, onRegisterView, onRegisterActionRunner, editorKey }: {
  markdown: string
  onMarkdownUpdate: (md: string, meta?: { normalized: boolean }) => void
  onRegisterView: (view: EditorView) => void
  onRegisterActionRunner: (runner: EditorActionRunner) => void
  editorKey: number
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedUpdate = useCallback((md: string) => {
    // 清理编辑器序列化产生的占位空行与多余换行
    const cleaned = normalizeEditorMarkdown(md)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (cleaned !== md) {
      onMarkdownUpdate(cleaned, { normalized: true })
      return
    }
    timerRef.current = setTimeout(() => onMarkdownUpdate(cleaned, { normalized: false }), 800)
  }, [onMarkdownUpdate])

  const { get } = useEditor((root) => {
    const crepe = new Crepe({ root, defaultValue: markdown })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => debouncedUpdate(md))
    })
    return crepe
  }, [])

  useEffect(() => {
    let configured = false
    const poll = setInterval(() => {
      const editor = get()
      if (!editor) return
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        if (view) {
          onRegisterView(view)
          onRegisterActionRunner((handler) => {
            editor.action(handler)
          })
            // 编辑器就绪后禁用 trailing 插件
            if (!configured) {
              configured = true
              try {
                ctx.set(trailingConfig.key, {
                  shouldAppend: () => false,
                  getNode: (state: EditorState) => state.schema.nodes.paragraph!.create()
                })
              } catch {}
            }
          clearInterval(poll)
        }
      })
    }, 100)
    return () => clearInterval(poll)
  }, [get, onRegisterActionRunner, onRegisterView])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      container.dispatchEvent(new CustomEvent('milkdown-contextmenu', {
        detail: { x: e.clientX, y: e.clientY },
        bubbles: true
      }))
    }
    container.addEventListener('contextmenu', handler, true)
    return () => container.removeEventListener('contextmenu', handler, true)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div ref={containerRef} className="milkdown-container">
      <Milkdown />
    </div>
  )
}

// === 主组件 ===
interface Props {
  note: string
  problemId: number
  onUpdateNote: (id: number, note: string) => void
}

const NoteEditor = memo(function NoteEditor({ note, problemId, onUpdateNote }: Props) {
  const [sourceMode, setSourceMode] = useState(false)
  const [markdown, setMarkdown] = useState(note)
  const [contextMenu, setContextMenu] = useState<ContextMenuPos | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [editorKey, setEditorKey] = useState(0)
  const [isRepairingView, setIsRepairingView] = useState(false)
  const [tableDialog, setTableDialog] = useState({ visible: false, rows: '3', cols: '3', error: '' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const actionRunnerRef = useRef<EditorActionRunner | null>(null)
  const pendingMenuRepairRef = useRef(false)
  const repairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSourceChange = (val: string) => {
    setMarkdown(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onUpdateNote(problemId, val), 1000)
  }

  const handleWysiwygUpdate = useCallback((md: string, meta?: { normalized: boolean }) => {
    setMarkdown(md)
    onUpdateNote(problemId, md)
    if (meta?.normalized && pendingMenuRepairRef.current) {
      if (repairTimerRef.current) clearTimeout(repairTimerRef.current)
      pendingMenuRepairRef.current = false
      setEditorKey(k => k + 1)
      return
    }
    if (!meta?.normalized) {
      if (repairTimerRef.current) clearTimeout(repairTimerRef.current)
      pendingMenuRepairRef.current = false
      setIsRepairingView(false)
    }
  }, [problemId, onUpdateNote])

  const handleRegisterView = useCallback((view: EditorView) => {
    viewRef.current = view
    if (repairTimerRef.current) clearTimeout(repairTimerRef.current)
    setIsRepairingView(false)
  }, [])

  const handleRegisterActionRunner = useCallback((runner: EditorActionRunner) => {
    actionRunnerRef.current = runner
  }, [])

  const openTableDialog = useCallback(() => {
    setTableDialog({ visible: true, rows: '3', cols: '3', error: '' })
  }, [])

  const closeTableDialog = useCallback(() => {
    setTableDialog(prev => ({ ...prev, visible: false, error: '' }))
  }, [])

  // 切换源码模式：保存当前 markdown，递增 editorKey 触发编辑器重建
  const toggleSourceMode = useCallback(() => {
    setSourceMode(prev => {
      const next = !prev
      if (!next) {
        // 源码 → WYSIWYG：用最新 markdown 重建编辑器
        setEditorKey(k => k + 1)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handler = (e: Event) => {
      const ce = e as CustomEvent
      if (viewRef.current) setMenuItems(buildMenu(viewRef.current, openTableDialog))
      setContextMenu({ x: ce.detail.x, y: ce.detail.y })
    }
    wrapper.addEventListener('milkdown-contextmenu', handler)
    return () => wrapper.removeEventListener('milkdown-contextmenu', handler)
  }, [openTableDialog])

  const handleAction = useCallback((actionFn: (view: EditorView, runWithCtx?: EditorActionRunner | null) => void, options?: { repairView?: boolean }) => {
    if (viewRef.current) {
      if (options?.repairView) {
        flushSync(() => {
          pendingMenuRepairRef.current = true
          setIsRepairingView(true)
          setContextMenu(null)
        })
        if (repairTimerRef.current) clearTimeout(repairTimerRef.current)
        repairTimerRef.current = setTimeout(() => {
          pendingMenuRepairRef.current = false
          setIsRepairingView(false)
        }, 200)
      }
      viewRef.current.focus()
      actionFn(viewRef.current, actionRunnerRef.current)
    }
    if (!options?.repairView) setContextMenu(null)
  }, [])

  const handleConfirmTable = useCallback(() => {
    const result = parseTableDimensions(tableDialog.rows, tableDialog.cols)
    if (typeof result === 'string') {
      setTableDialog(prev => ({ ...prev, error: result }))
      return
    }

    closeTableDialog()
    handleAction((view, runWithCtx) => {
      insertTableBlock(view, runWithCtx, result.rows, result.cols)
    }, { repairView: true })
  }, [closeTableDialog, handleAction, tableDialog.cols, tableDialog.rows])

  useEffect(() => {
    if (!contextMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.ctx-menu')) setContextMenu(null)
    }
    const id = requestAnimationFrame(() => document.addEventListener('mousedown', close))
    return () => { cancelAnimationFrame(id); document.removeEventListener('mousedown', close) }
  }, [contextMenu])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (repairTimerRef.current) clearTimeout(repairTimerRef.current)
  }, [])

  const iconRows = [
    menuItems.filter(i => i.type === 'action' && ['✂','⎘','📋','🗑'].includes(i.icon)),
    menuItems.filter(i => i.type === 'action' && ['❝','1.','•','☑'].includes(i.icon)),
    menuItems.filter(i => i.type === 'action' && ['→','←'].includes(i.icon)),
  ]
  const submenus = menuItems.filter((i): i is Extract<MenuItem, {type:'submenu'}> => i.type === 'submenu')

  return (
    <div className="note-editor" onClick={e => e.stopPropagation()}>
      <div
        ref={wrapperRef}
        className={`note-editor-wysiwyg ${sourceMode ? 'hidden' : ''}`}
        style={isRepairingView ? { visibility: 'hidden' } : undefined}
      >
        <MilkdownProvider>
          <EditorInner
            key={editorKey}
            markdown={markdown}
            onMarkdownUpdate={handleWysiwygUpdate}
            onRegisterView={handleRegisterView}
            onRegisterActionRunner={handleRegisterActionRunner}
            editorKey={editorKey}
          />
        </MilkdownProvider>
      </div>
      <textarea
        className={`note-editor-source ${sourceMode ? '' : 'hidden'}`}
        value={markdown}
        onChange={e => handleSourceChange(e.target.value)}
        placeholder="输入 Markdown..."
        spellCheck={false}
      />
      <div className="note-editor-footer">
        <button
          className={`source-toggle ${sourceMode ? 'active' : ''}`}
          onClick={toggleSourceMode}
          title={sourceMode ? '退出源码模式' : '切换源码模式'}
        >
          {sourceMode ? '退出源码' : '</>'}
        </button>
      </div>

      {tableDialog.visible && (
        <div className="dialog-overlay" onClick={closeTableDialog}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>插入表格</h3>
            <p className="dialog-hint">请输入表格的行数和列数。</p>
            <div className="table-dimension-grid">
              <label className="table-dimension-field">
                <span>行数</span>
                <input
                  className="dialog-input"
                  type="number"
                  min="1"
                  step="1"
                  value={tableDialog.rows}
                  onChange={e => setTableDialog(prev => ({ ...prev, rows: e.target.value, error: '' }))}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmTable()}
                  autoFocus
                />
              </label>
              <label className="table-dimension-field">
                <span>列数</span>
                <input
                  className="dialog-input"
                  type="number"
                  min="1"
                  step="1"
                  value={tableDialog.cols}
                  onChange={e => setTableDialog(prev => ({ ...prev, cols: e.target.value, error: '' }))}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmTable()}
                />
              </label>
            </div>
            {tableDialog.error && <div className="dialog-error">{tableDialog.error}</div>}
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={closeTableDialog}>取消</button>
              <button className="btn-primary" onClick={handleConfirmTable}>创建</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="ctx-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {iconRows.map((row, ri) => (
            <div key={ri}>
              {ri > 0 && <div className="ctx-menu-divider" />}
              <div className="ctx-menu-icons">
                {row.map((item, i) => (
                  item.type === 'action' && (
                    <button key={i} className="ctx-menu-icon-btn" onClick={() => handleAction(item.action)} title={item.label}>
                      {item.icon}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
          <div className="ctx-menu-divider" />
          {submenus.map((item, i) => (
            <SubmenuItemComponent key={i} item={item} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
})

export default NoteEditor
