import { ChevronDown, Layers3 } from 'lucide-react'
import { TabCard, type MoveTarget } from './TabCard'
import type { BoardColumn } from './types'
import type { TabCard as TabCardModel } from '../types'

interface GroupColumnProps {
  column: BoardColumn
  moveTargets: MoveTarget[]
  onDropTab: (tabId: number, targetId: BoardColumn['id']) => void
  onMoveTab: (tabId: number, targetId: MoveTarget['id']) => void
  onActivateTab: (tab: TabCardModel) => void
  onRenameTab: (tabId: number) => void
  onCloseTab: (tabId: number) => void
  onToggleCollapse: (column: BoardColumn) => void
}

export function GroupColumn({
  column,
  moveTargets,
  onDropTab,
  onMoveTab,
  onActivateTab,
  onRenameTab,
  onCloseTab,
  onToggleCollapse,
}: GroupColumnProps) {
  return (
    <section
      className={`group-column${column.pending ? ' pending' : ''}`}
      data-color={column.color}
      onDragOver={(event) => {
        event.preventDefault()
        event.currentTarget.classList.add('drag-over')
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          event.currentTarget.classList.remove('drag-over')
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.currentTarget.classList.remove('drag-over')
        const tabId = Number(event.dataTransfer.getData('text/tabloom-tab-id'))
        if (Number.isInteger(tabId)) {
          onDropTab(tabId, column.id)
        }
      }}
    >
      <header className="group-header">
        <span className="group-color" aria-hidden="true" />
        <div>
          <span>{column.pending ? '待创建分组' : '标签组'}</span>
          <strong>{column.title}</strong>
        </div>
        <span className="tab-count">{column.tabs.length}</span>
        {typeof column.id === 'number' && (
          <button
            className={column.collapsed ? 'collapsed' : ''}
            aria-label={column.collapsed ? '展开 Chrome 标签组' : '折叠 Chrome 标签组'}
            onClick={() => onToggleCollapse(column)}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </header>

      <div className="group-body">
        {column.tabs.length === 0 ? (
          <div className="drop-placeholder">
            <Layers3 size={20} />
            <span>{column.pending ? '拖入第一个标签以创建' : '拖放标签到这里'}</span>
          </div>
        ) : (
          column.tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              moveTargets={moveTargets.filter((target) => target.id !== column.id)}
              onMove={onMoveTab}
              onActivate={onActivateTab}
              onRename={onRenameTab}
              onClose={onCloseTab}
            />
          ))
        )}
      </div>
    </section>
  )
}
