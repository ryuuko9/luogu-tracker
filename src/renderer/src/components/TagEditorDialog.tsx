import { useEffect, useMemo, useState } from 'react'

import type { TagCatalogState } from '../types'
import { mergeProblemTags, normalizeTagList } from '../problemTags'

interface Props {
  visible: boolean
  originalTags: string[]
  userTags: string[]
  hiddenOriginalTags: string[]
  onClose: () => void
  onLoadCatalog: () => Promise<TagCatalogState>
  onRefreshCatalog: () => Promise<TagCatalogState>
  onSave: (userTags: string[], hiddenOriginalTags: string[]) => Promise<void>
}

export default function TagEditorDialog({
  visible,
  originalTags,
  userTags,
  hiddenOriginalTags,
  onClose,
  onLoadCatalog,
  onRefreshCatalog,
  onSave,
}: Props) {
  const [draftUserTags, setDraftUserTags] = useState<string[]>([])
  const [draftHiddenOriginalTags, setDraftHiddenOriginalTags] = useState<string[]>([])
  const [catalogState, setCatalogState] = useState<TagCatalogState>({ tags: [], updatedAt: null })
  const [search, setSearch] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [refreshingCatalog, setRefreshingCatalog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const originalTagSet = useMemo(() => new Set(normalizeTagList(originalTags)), [originalTags])

  const visibleTags = useMemo(
    () => mergeProblemTags(originalTags, draftHiddenOriginalTags, draftUserTags),
    [draftHiddenOriginalTags, draftUserTags, originalTags],
  )

  const hiddenOriginalTagList = useMemo(
    () => normalizeTagList(originalTags).filter(tag => draftHiddenOriginalTags.includes(tag)),
    [draftHiddenOriginalTags, originalTags],
  )

  const filteredCatalog = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return catalogState.tags
    return catalogState.tags.filter(tag => tag.toLowerCase().includes(keyword))
  }, [catalogState.tags, search])

  useEffect(() => {
    if (!visible) return

    setDraftUserTags(normalizeTagList(userTags))
    setDraftHiddenOriginalTags(normalizeTagList(hiddenOriginalTags))
    setSearch('')
    setError(null)

    let cancelled = false

    const loadCatalog = async () => {
      setLoadingCatalog(true)
      try {
        const localCatalog = await onLoadCatalog()
        if (cancelled) return

        if (localCatalog.tags.length > 0) {
          setCatalogState(localCatalog)
          return
        }

        const refreshedCatalog = await onRefreshCatalog()
        if (!cancelled) {
          setCatalogState(refreshedCatalog)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '标签列表加载失败，请重试')
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalog(false)
        }
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [hiddenOriginalTags, onLoadCatalog, onRefreshCatalog, userTags, visible])

  if (!visible) return null

  const handleToggleCatalogTag = (tag: string) => {
    setError(null)

    if (originalTagSet.has(tag)) {
      setDraftHiddenOriginalTags(prev => (
        prev.includes(tag)
          ? prev.filter(item => item !== tag)
          : [...prev, tag]
      ))
      return
    }

    setDraftUserTags(prev => (
      prev.includes(tag)
        ? prev.filter(item => item !== tag)
        : [...prev, tag]
    ))
  }

  const handleRefreshCatalog = async () => {
    setRefreshingCatalog(true)
    setError(null)
    try {
      setCatalogState(await onRefreshCatalog())
    } catch (err) {
      setError(err instanceof Error ? err.message : '标签列表刷新失败，请重试')
    } finally {
      setRefreshingCatalog(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(
        normalizeTagList(draftUserTags.filter(tag => !originalTagSet.has(tag))),
        normalizeTagList(draftHiddenOriginalTags.filter(tag => originalTagSet.has(tag))),
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '标签保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const updatedAtText = catalogState.updatedAt
    ? new Date(catalogState.updatedAt).toLocaleString('zh-CN', { hour12: false })
    : '尚未刷新'

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog tag-editor-dialog" onClick={e => e.stopPropagation()}>
        <div className="tag-editor-header">
          <div>
            <h3>编辑知识点标签</h3>
            <p className="dialog-hint">最终显示标签会保留原始标签、隐藏被排除的原始标签，并追加你手动选择的标签。</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => void handleRefreshCatalog()}
            disabled={refreshingCatalog || loadingCatalog}
          >
            {refreshingCatalog ? '刷新中...' : '刷新标签全集'}
          </button>
        </div>

        <div className="tag-editor-meta">标签全集上次刷新：{updatedAtText}</div>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">当前显示标签</div>
          <div className="tag-editor-chip-list">
            {visibleTags.length > 0 ? (
              visibleTags.map(tag => (
                <span key={tag} className="problem-tag tag-editor-chip tag-editor-chip-visible">{tag}</span>
              ))
            ) : (
              <div className="tag-editor-empty">当前没有显示中的知识点标签</div>
            )}
          </div>
        </div>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">搜索洛谷知识点标签</div>
          <input
            className="dialog-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="输入标签关键字..."
          />
        </div>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">候选标签</div>
          <div className="tag-editor-chip-list tag-editor-chip-panel">
            {loadingCatalog ? (
              <div className="tag-editor-empty">标签全集加载中...</div>
            ) : filteredCatalog.length === 0 ? (
              <div className="tag-editor-empty">没有匹配的标签</div>
            ) : (
              filteredCatalog.map(tag => {
                const isOriginal = originalTagSet.has(tag)
                const isHiddenOriginal = draftHiddenOriginalTags.includes(tag)
                const isUserTag = draftUserTags.includes(tag)
                const className = [
                  'tag-editor-chip-button',
                  isOriginal && !isHiddenOriginal ? 'tag-editor-chip-selected' : '',
                  isOriginal && isHiddenOriginal ? 'tag-editor-chip-hidden' : '',
                  !isOriginal && isUserTag ? 'tag-editor-chip-selected' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={tag}
                    className={className}
                    onClick={() => handleToggleCatalogTag(tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">已隐藏的原始标签</div>
          <div className="tag-editor-chip-list">
            {hiddenOriginalTagList.length > 0 ? (
              hiddenOriginalTagList.map(tag => (
                <button
                  key={tag}
                  className="tag-editor-chip-button tag-editor-chip-hidden"
                  onClick={() => handleToggleCatalogTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))
            ) : (
              <div className="tag-editor-empty">当前没有隐藏任何原始标签</div>
            )}
          </div>
        </div>

        {error && <div className="dialog-error">{error}</div>}

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中...' : '保存标签'}
          </button>
        </div>
      </div>
    </div>
  )
}
