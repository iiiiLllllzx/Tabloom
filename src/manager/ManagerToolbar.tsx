import { RefreshCw, Search, Sparkles, Tags } from 'lucide-react'
import type { ExtensionSettings, WindowSummary } from '../types'

interface ManagerToolbarProps {
  windows: WindowSummary[]
  selectedWindowId?: number
  query: string
  settings?: ExtensionSettings
  busy: boolean
  onWindowChange: (windowId: number) => void
  onQueryChange: (query: string) => void
  onAutoGroup: () => void
  onRefresh: () => void
  onToggleAutoGroup: () => void
}

export function ManagerToolbar({
  windows,
  selectedWindowId,
  query,
  settings,
  busy,
  onWindowChange,
  onQueryChange,
  onAutoGroup,
  onRefresh,
  onToggleAutoGroup,
}: ManagerToolbarProps) {
  return (
    <header className="manager-toolbar">
      <div className="manager-brand">
        <span><Tags size={21} /></span>
        <div>
          <strong>Tabloom</strong>
          <small>TAB OPERATIONS DESK</small>
        </div>
      </div>

      <label className="window-picker">
        <span>窗口</span>
        <select
          value={selectedWindowId ?? ''}
          onChange={(event) => onWindowChange(Number(event.target.value))}
        >
          {windows.map((window, index) => (
            <option key={window.id} value={window.id}>
              窗口 {index + 1} · {window.tabCount} 个标签{window.focused ? ' · 当前' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题或域名"
        />
      </label>

      <button className="toolbar-button" onClick={onRefresh} disabled={busy}>
        <RefreshCw size={16} /> 刷新
      </button>
      <button className="toolbar-button primary" onClick={onAutoGroup} disabled={busy}>
        <Sparkles size={16} /> 按域名整理
      </button>

      <label className="toolbar-switch">
        <span>自动</span>
        <input
          type="checkbox"
          checked={settings?.autoGroupEnabled ?? false}
          disabled={!settings}
          onChange={onToggleAutoGroup}
        />
      </label>
    </header>
  )
}
