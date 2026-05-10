import type { Problem } from '../types'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../types'

interface Props {
  problem: Problem
  expanded: boolean
  onToggle: (id: number) => void
  onToggleExpand: (id: number) => void
  onOpenUrl: (pid: string) => void
}

export default function ProblemItem({ problem, expanded, onToggle, onToggleExpand, onOpenUrl }: Props) {
  const diffColor = DIFFICULTY_COLORS[problem.difficulty] ?? '#9ca3af'
  const diffLabel = DIFFICULTY_LABELS[problem.difficulty] ?? '未知'

  return (
    <div className={`problem-item ${problem.completed ? 'completed' : ''}`}>
      <div className="problem-row">
        <input
          type="checkbox"
          checked={problem.completed}
          onChange={() => onToggle(problem.id)}
          className="problem-checkbox"
        />
        <span
          className="problem-pid"
          onClick={() => onOpenUrl(problem.pid)}
          title={`打开 ${problem.pid}`}
        >
          {problem.pid}
        </span>
        <span
          className="problem-title"
          onClick={() => onToggleExpand(problem.id)}
        >
          {problem.title}
        </span>
        <div className="problem-meta">
          <div className="problem-tags">
            {problem.tags.map(tag => (
              <span key={tag} className="problem-tag">{tag}</span>
            ))}
          </div>
          <div className="problem-difficulty-wrap">
            <span className="problem-difficulty" style={{ backgroundColor: diffColor }}>
              {diffLabel}
            </span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="problem-expanded" />
      )}
    </div>
  )
}
