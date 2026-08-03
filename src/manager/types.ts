import type { GroupColor, GroupColumn, TabCard } from '../types'

export interface PendingGroup {
  id: string
  title: string
  color: GroupColor
}

export interface BoardColumn {
  id: number | 'ungrouped' | string
  windowId: number
  title: string
  color: GroupColor | 'neutral'
  collapsed: boolean
  tabs: TabCard[]
  pending?: boolean
}

export function toBoardColumn(column: GroupColumn): BoardColumn {
  return column
}
