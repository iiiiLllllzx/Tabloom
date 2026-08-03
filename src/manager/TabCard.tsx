import { ExternalLink, GripVertical, Pencil, Pin, X } from 'lucide-react'
import type { TabCard as TabCardModel } from '../types'

export interface MoveTarget {
  id: number | 'ungrouped' | string
  title: string
}

interface TabCardProps {
  tab: TabCardModel
  moveTargets: MoveTarget[]
  onMove: (tabId: number, targetId: MoveTarget['id']) => void
  onActivate: (tab: TabCardModel) => void
  onRename: (tabId: number) => void
  onClose: (tabId: number) => void
}

export function TabCard({
  tab,
  moveTargets,
  onMove,
  onActivate,
  onRename,
  onClose,
}: TabCardProps) {
  return (
    <article
      className={`tab-card${tab.active ? ' active' : ''}${tab.pinned ? ' pinned' : ''}`}
      draggable={!tab.pinned}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/tabloom-tab-id', String(tab.id))
      }}
    >
      <button className="drag-handle" aria-label="拖动标签" disabled={tab.pinned}>
        {tab.pinned ? <Pin size={14} /> : <GripVertical size={15} />}
      </button>
      <button className="tab-identity" onClick={() => onActivate(tab)}>
        <span className="tab-favicon">
          {tab.favIconUrl ? <img src={tab.favIconUrl} alt="" /> : <span>·</span>}
        </span>
        <span className="tab-copy">
          <strong>{tab.customTitle || tab.title}</strong>
          <code>{tab.hostname ?? '受限页面'}</code>
        </span>
        <ExternalLink size={13} />
      </button>
      <div className="tab-actions">
        <select
          aria-label={`移动 ${tab.title} 到分组`}
          value=""
          disabled={tab.pinned}
          onChange={(event) => {
            const rawValue = event.target.value
            if (!rawValue) return
            const targetId = /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue
            onMove(tab.id, targetId)
          }}
        >
          <option value="">移动到…</option>
          {moveTargets.map((target) => (
            <option key={String(target.id)} value={String(target.id)}>
              {target.title}
            </option>
          ))}
        </select>
        <button aria-label="重命名标签" onClick={() => onRename(tab.id)}>
          <Pencil size={14} />
        </button>
        <button className="danger" aria-label="关闭标签" onClick={() => onClose(tab.id)}>
          <X size={15} />
        </button>
      </div>
    </article>
  )
}
