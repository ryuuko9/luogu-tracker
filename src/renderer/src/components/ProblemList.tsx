import { useState, useEffect, useMemo } from 'react'
import type { Problem } from '../types'
import ProblemItem from './ProblemItem'
import NoteEditor from './NoteEditor'
import FilterBar from './FilterBar'

interface Props {
  problems: Problem[]
  trainingId: number | null
  allTags: string[]
  onToggle: (id: number) => void
  onUpdateNote: (id: number, note: string) => void
  onUpdateTags: (id: number, userTags: string[], hiddenOriginalTags: string[]) => Promise<void>
  onLoadTagCatalog: () => Promise<{ tags: string[]; updatedAt: string | null }>
  onRefreshTagCatalog: () => Promise<{ tags: string[]; updatedAt: string | null }>
}

export default function ProblemList({
  problems,
  trainingId,
  allTags,
  onToggle,
  onUpdateNote,
  onUpdateTags,
  onLoadTagCatalog,
  onRefreshTagCatalog,
}: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'uncompleted'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // 切换题单后重置筛选状态，避免沿用上一个题单的过滤条件导致空列表
  useEffect(() => {
    setSearch('')
    setStatusFilter('all')
    setDifficultyFilter(null)
    setTagFilter(null)
    setExpandedId(null)
  }, [trainingId])

  // 当前题单不再包含已选标签时，自动清理失效标签筛选
  useEffect(() => {
    if (tagFilter && !allTags.includes(tagFilter)) {
      setTagFilter(null)
    }
  }, [allTags, tagFilter])

  const filtered = useMemo(() => {
    return problems.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.pid.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) return false
      }
      if (statusFilter === 'completed' && !p.completed) return false
      if (statusFilter === 'uncompleted' && p.completed) return false
      if (difficultyFilter === '7-9' && ![7, 8, 9].includes(p.difficulty)) return false
      if (difficultyFilter !== null && difficultyFilter !== '7-9' && p.difficulty !== Number(difficultyFilter)) return false
      if (tagFilter && !p.tags.includes(tagFilter)) return false
      return true
    })
  }, [problems, search, statusFilter, difficultyFilter, tagFilter])

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const handleOpenUrl = (pid: string) => {
    window.api.openUrl(`https://www.luogu.com.cn/problem/${pid}`)
  }

  const completedCount = problems.filter(p => p.completed).length
  const totalCount = problems.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="problem-list-container">
      {totalCount > 0 && (
        <div className="problem-stats">
          <div className="stats-text">已完成 {completedCount} / {totalCount}（{pct}%）</div>
          <div className="stats-progress-bar">
            <div className="stats-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        difficultyFilter={difficultyFilter}
        onDifficultyFilterChange={setDifficultyFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        allTags={allTags}
      />
      <div className="problem-list">
        {filtered.length === 0 && (
          <div className="problem-empty">
            {totalCount === 0 ? '请从左侧选择一个题单' : '没有匹配的题目'}
          </div>
        )}
        {filtered.map(p => (
          <div key={p.id}>
            <ProblemItem
              problem={p}
              expanded={expandedId === p.id}
              onToggle={onToggle}
              onToggleExpand={toggleExpand}
              onOpenUrl={handleOpenUrl}
            />
            {expandedId === p.id && (
              <NoteEditor
                note={p.note}
                problemId={p.id}
                completed={p.completed}
                originalTags={p.originalTags}
                userTags={p.userTags}
                hiddenOriginalTags={p.hiddenOriginalTags}
                onUpdateNote={onUpdateNote}
                onUpdateTags={onUpdateTags}
                onLoadTagCatalog={onLoadTagCatalog}
                onRefreshTagCatalog={onRefreshTagCatalog}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
