import { DIFFICULTY_LABELS } from '../types'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: 'all' | 'completed' | 'uncompleted'
  onStatusFilterChange: (v: 'all' | 'completed' | 'uncompleted') => void
  difficultyFilter: string | null
  onDifficultyFilterChange: (v: string | null) => void
  tagFilter: string | null
  onTagFilterChange: (v: string | null) => void
  allTags: string[]
}

export default function FilterBar({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  difficultyFilter, onDifficultyFilterChange,
  tagFilter, onTagFilterChange,
  allTags
}: Props) {
  const difficulties = [
    { value: '1', label: DIFFICULTY_LABELS[1] },
    { value: '2', label: DIFFICULTY_LABELS[2] },
    { value: '3', label: DIFFICULTY_LABELS[3] },
    { value: '4', label: DIFFICULTY_LABELS[4] },
    { value: '5', label: DIFFICULTY_LABELS[5] },
    { value: '6', label: DIFFICULTY_LABELS[6] },
    { value: '7-9', label: DIFFICULTY_LABELS[7] }
  ]

  return (
    <div className="filter-bar">
      <input
        className="filter-search"
        type="text"
        placeholder="搜索题号或标题..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
      />
      <select
        className="filter-select"
        value={statusFilter}
        onChange={e => onStatusFilterChange(e.target.value as 'all' | 'completed' | 'uncompleted')}
      >
        <option value="all">全部状态</option>
        <option value="completed">已完成</option>
        <option value="uncompleted">未完成</option>
      </select>
      <select
        className="filter-select"
        value={difficultyFilter ?? ''}
        onChange={e => onDifficultyFilterChange(e.target.value || null)}
      >
        <option value="">全部难度</option>
        {difficulties.map(d => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
      <select
        className="filter-select"
        value={tagFilter ?? ''}
        onChange={e => onTagFilterChange(e.target.value || null)}
      >
        <option value="">全部标签</option>
        {allTags.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}
