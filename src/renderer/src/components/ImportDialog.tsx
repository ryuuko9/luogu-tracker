import { useState } from 'react'

interface Props {
  visible: boolean
  importing: boolean
  onImport: (input: string) => Promise<void>
  onClose: () => void
}

export default function ImportDialog({ visible, importing, onImport, onClose }: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  if (!visible) return null

  const handleImport = async () => {
    const val = input.trim()
    if (!val) {
      setError('请输入题单链接或 ID')
      return
    }
    setError('')
    try {
      await onImport(val)
    } catch (error) {
      setError(error instanceof Error ? error.message : '导入失败，请稍后重试')
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>导入洛谷题单</h3>
        <p className="dialog-hint">
          输入题单链接或数字 ID，例如：
          <br />
          <code>https://www.luogu.com.cn/training/100</code> 或 <code>100</code>
        </p>
        <input
          className="dialog-input"
          type="text"
          placeholder="粘贴题单链接或 ID..."
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleImport()}
          disabled={importing}
          autoFocus
        />
        {error && <div className="dialog-error">{error}</div>}
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose} disabled={importing}>取消</button>
          <button className="btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
