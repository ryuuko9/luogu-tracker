import type { Training, UserInfo } from '../types'

interface Props {
  trainings: Training[]
  selectedId: number | null
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  onImport: () => void
  userInfo: UserInfo | null
  onLogin: () => void
  onOpenLoginDialog: () => void
}

export default function Sidebar({
  trainings,
  selectedId,
  onSelect,
  onDelete,
  onImport,
  userInfo,
  onLogin,
  onOpenLoginDialog
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>题单列表</h2>
        <div className="sidebar-header-actions">
          {userInfo ? (
            <button className="btn-avatar" onClick={onOpenLoginDialog} title={userInfo.nickname}>
              <img src={userInfo.avatar} alt={userInfo.nickname} />
            </button>
          ) : (
            <button className="btn-login" onClick={onLogin}>登录洛谷</button>
          )}
          <button className="btn-import" onClick={onImport}>+ 导入</button>
        </div>
      </div>
      <div className="sidebar-list">
        {trainings.length === 0 && (
          <div className="sidebar-empty">暂无题单，点击上方导入</div>
        )}
        {trainings.map(t => {
          const pct = t.problemCount > 0 ? Math.round((t.completedCount / t.problemCount) * 100) : 0
          const isSelected = t.id === selectedId
          return (
            <div
              key={t.id}
              className={`sidebar-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="sidebar-item-name">{t.name}</div>
              <div className="sidebar-item-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="progress-text">{t.completedCount}/{t.problemCount} ({pct}%)</span>
              </div>
              <button
                className="btn-delete"
                onClick={e => { e.stopPropagation(); onDelete(t.id) }}
                title="删除题单"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
