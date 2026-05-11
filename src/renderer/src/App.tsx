import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ProblemList from './components/ProblemList'
import ImportDialog from './components/ImportDialog'
import { useApi } from './hooks/useApi'
import type { Training } from './types'
import { resolveInitialTheme, THEME_STORAGE_KEY, type ThemeMode } from './themePreference'

export default function App() {
  const {
    trainings, problems, importing, userInfo,
    fetchTrainings, fetchProblems, importTraining,
    deleteTraining, toggleProblem, updateNote, updateProblemTags,
    getTagCatalog, refreshTagCatalog,
    fetchLoginStatus, handleLogin, handleLogout
  } = useApi()

  const [selectedTrainingId, setSelectedTrainingId] = useState<number | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [pendingDeleteTraining, setPendingDeleteTraining] = useState<Training | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return resolveInitialTheme(savedTheme, prefersDark)
  })

  // 初始化加载题单列表和登录状态
  useEffect(() => {
    fetchTrainings()
    fetchLoginStatus()
  }, [fetchTrainings, fetchLoginStatus])

  // 登录窗口关闭后刷新状态
  useEffect(() => {
    const handleFocus = () => {
      fetchLoginStatus()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchLoginStatus])

  // 切换题单时加载题目
  useEffect(() => {
    if (selectedTrainingId !== null) {
      fetchProblems(selectedTrainingId)
    }
  }, [selectedTrainingId, fetchProblems])

  // 题单列表更新后，如果没有选中的，自动选中第一个
  useEffect(() => {
    if (selectedTrainingId === null && trainings.length > 0) {
      setSelectedTrainingId(trainings[0].id)
    }
    if (selectedTrainingId !== null && !trainings.find(t => t.id === selectedTrainingId)) {
      setSelectedTrainingId(trainings.length > 0 ? trainings[0].id : null)
    }
  }, [trainings, selectedTrainingId])

  // 深色模式
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const handleImport = useCallback(async (input: string) => {
    await importTraining(input)
    setShowImport(false)
  }, [importTraining])

  const handleRequestDelete = useCallback((id: number) => {
    const training = trainings.find(t => t.id === id)
    if (!training) return
    setPendingDeleteTraining(training)
  }, [trainings])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteTraining) return
    await deleteTraining(pendingDeleteTraining.id)
    setPendingDeleteTraining(null)
  }, [deleteTraining, pendingDeleteTraining])

  const allTags = [...new Set(problems.flatMap(p => p.tags))].sort()

  return (
    <div className="app">
      <Sidebar
        trainings={trainings}
        selectedId={selectedTrainingId}
        onSelect={setSelectedTrainingId}
        onDelete={handleRequestDelete}
        onImport={() => setShowImport(true)}
        userInfo={userInfo}
        onLogin={handleLogin}
        onOpenLoginDialog={() => setShowLoginDialog(true)}
      />
      <main className="main-panel">
        <div className="main-header">
          <h1 className="main-title">
            {selectedTrainingId
              ? trainings.find(t => t.id === selectedTrainingId)?.name ?? ''
              : '洛谷题单管理'}
          </h1>
          <button
            className="btn-theme"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
            aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
          >
            <span className="btn-theme-icon" aria-hidden="true">
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
          </button>
        </div>
        <ProblemList
          problems={selectedTrainingId ? problems : []}
          trainingId={selectedTrainingId}
          allTags={allTags}
          onToggle={toggleProblem}
          onUpdateNote={updateNote}
          onUpdateTags={updateProblemTags}
          onLoadTagCatalog={getTagCatalog}
          onRefreshTagCatalog={refreshTagCatalog}
        />
      </main>
      <ImportDialog
        visible={showImport}
        importing={importing}
        onImport={handleImport}
        onClose={() => setShowImport(false)}
      />
      {showLoginDialog && userInfo && (
        <div className="dialog-overlay" onClick={() => setShowLoginDialog(false)}>
          <div className="dialog login-dialog" onClick={e => e.stopPropagation()}>
            <div className="login-dialog-header">
              <img className="login-avatar" src={userInfo.avatar} alt={userInfo.nickname} />
              <div className="login-user-info">
                <div className="login-nickname">{userInfo.nickname}</div>
              </div>
            </div>
            <div className="dialog-actions login-dialog-actions">
              <button className="btn-primary" onClick={() => { setShowLoginDialog(false); handleLogin() }}>
                重新登录
              </button>
              <button className="btn-danger" onClick={() => { handleLogout(); setShowLoginDialog(false); }}>
                退出登录
              </button>
              <button className="btn-secondary" onClick={() => setShowLoginDialog(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {pendingDeleteTraining && (
        <div className="dialog-overlay" onClick={() => setPendingDeleteTraining(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>确认删除题单</h3>
            <p className="dialog-hint">
              确认要删除题单
              <code>{pendingDeleteTraining.name}</code>
              吗？此操作不可撤销。
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setPendingDeleteTraining(null)}>取消</button>
              <button className="btn-danger" onClick={handleConfirmDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
