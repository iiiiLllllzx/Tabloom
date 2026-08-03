import {
  History,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  Unlink,
} from 'lucide-react'
import type { ExtensionSettings, WindowSummary } from '../types'

interface ManagerToolbarProps {
  windows: WindowSummary[]
  selectedWindowId?: number
  query: string
  settings?: ExtensionSettings
  busy: boolean
  canUndo: boolean
  canRestore: boolean
  onWindowChange: (windowId: number) => void
  onQueryChange: (query: string) => void
  onAutoGroup: () => void
  onUngroupAll: () => void
  onThresholdChange: (value: number) => void
  onUndo: () => void
  onRestore: () => void
  onRefresh: () => void
  onToggleAutoGroup: () => void
}

export function ManagerToolbar({
  windows,
  selectedWindowId,
  query,
  settings,
  busy,
  canUndo,
  canRestore,
  onWindowChange,
  onQueryChange,
  onAutoGroup,
  onUngroupAll,
  onThresholdChange,
  onUndo,
  onRestore,
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

      <label className="threshold-picker">
        <span>阈值</span>
        <input
          type="number"
          min="2"
          max="20"
          value={settings?.minTabsPerGroup ?? 3}
          disabled={!settings || busy}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
          aria-label="分组阈值"
        />
      </label>

      <button className="toolbar-button" onClick={onRefresh} disabled={busy}>
        <RefreshCw size={16} /> 刷新
      </button>
      <button
        className="toolbar-button"
        onClick={onUndo}
        disabled={busy || !canUndo}
        title="撤销上一次分组操作"
      >
        <RotateCcw size={16} /> 撤销
      </button>
      <button
        className="toolbar-button"
        onClick={onRestore}
        disabled={busy || !canRestore}
        title="恢复到 Tabloom 首次修改前的分组"
      >
        <History size={16} /> 恢复分组
      </button>
      <button className="toolbar-button primary" onClick={onAutoGroup} disabled={busy}>
        <Sparkles size={16} /> 按域名整理
      </button>
      <button className="toolbar-button danger" onClick={onUngroupAll} disabled={busy}>
        <Unlink size={16} /> 取消分组
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
