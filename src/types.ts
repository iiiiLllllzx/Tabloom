export const GROUP_COLORS = [
  'blue',
  'orange',
  'green',
  'purple',
  'yellow',
  'cyan',
  'red',
  'grey',
  'pink',
] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export interface ExtensionSettings {
  schemaVersion: 4
  autoGroupEnabled: boolean
  minTabsPerGroup: number
}

export interface TabTitleOverride {
  tabId: number
  title: string
  updatedAt: number
}

export type ManualPreferenceMode = 'manual-group' | 'keep-ungrouped'

export interface ManualTabPreference {
  tabId: number
  mode: ManualPreferenceMode
  updatedAt: number
}

export interface SavedTabGroup {
  title: string
  color: GroupColor
  collapsed: boolean
  tabIds: number[]
}

export interface GroupingSnapshot {
  windowId: number
  createdAt: number
  groups: SavedTabGroup[]
  ungroupedTabIds: number[]
  manualPreferences: Record<string, ManualTabPreference>
}

export interface GroupHistoryState {
  baseline?: GroupingSnapshot
  undoStack: GroupingSnapshot[]
}

export interface GroupHistoryStatus {
  canUndo: boolean
  canRestore: boolean
}

export interface TabCard {
  id: number
  windowId: number
  groupId: number
  title: string
  url?: string
  hostname?: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  customTitle?: string
}

export interface GroupColumn {
  id: number | 'ungrouped'
  windowId: number
  title: string
  color: GroupColor | 'neutral'
  collapsed: boolean
  tabs: TabCard[]
}

export interface WindowSummary {
  id: number
  focused: boolean
  tabCount: number
}

export interface WorkspaceSnapshot {
  selectedWindowId: number
  windows: WindowSummary[]
  columns: GroupColumn[]
  history: GroupHistoryStatus
}

export interface AutoGroupResult {
  groupedTabs: number
  ungroupedTabs: number
  movedTabs: number
  createdGroups: number
  reusedGroups: number
}

export interface MultiWindowGroupResult extends AutoGroupResult {
  processedWindows: number
}

export interface UngroupAllResult {
  processedWindows: number
  ungroupedTabs: number
}

export type WindowSwitcherNavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Enter'
  | 'Escape'

export type RuntimeRequest =
  | { type: 'TITLE_CONTENT_READY' }
  | { type: 'TITLE_GET'; tabId: number }
  | { type: 'TITLE_SET'; tabId?: number; title: string }
  | { type: 'TITLE_CLEAR'; tabId: number }
  | { type: 'TITLE_PROMPT'; tabId?: number }
  | { type: 'SETTINGS_GET' }
  | { type: 'SETTINGS_UPDATE'; settings: Partial<ExtensionSettings> }
  | { type: 'GROUP_AUTO'; windowId: number; force?: boolean }
  | { type: 'GROUP_AUTO_ALL' }
  | { type: 'GROUP_UNGROUP_ALL' }
  | { type: 'GROUP_MOVE'; tabId: number; groupId: number }
  | {
      type: 'GROUP_CREATE'
      tabId: number
      windowId: number
      title: string
      color: GroupColor
    }
  | { type: 'GROUP_UNGROUP'; tabId: number }
  | { type: 'GROUP_UNDO'; windowId: number }
  | { type: 'GROUP_RESTORE'; windowId: number }
  | {
      type: 'GROUP_UPDATE'
      groupId: number
      changes: { title?: string; color?: GroupColor; collapsed?: boolean }
    }
  | { type: 'WORKSPACE_GET'; windowId?: number }
  | { type: 'TAB_ACTIVATE'; tabId: number; windowId: number }
  | { type: 'TAB_CLOSE'; tabId: number }
  | { type: 'SIDEPANEL_OPEN' }
  | { type: 'SIDEPANEL_READY'; windowId: number }
  | { type: 'SIDEPANEL_CLOSED'; windowId: number }
  | { type: 'SIDEPANEL_KEY'; key: WindowSwitcherNavigationKey }

export type ContentRequest =
  | { type: 'CONTENT_PING' }
  | { type: 'CONTENT_APPLY_TITLE'; title: string }
  | { type: 'CONTENT_CLEAR_TITLE' }
  | { type: 'CONTENT_WINDOW_SWITCHER_MODE'; active: boolean }

export type ErrorCode =
  | 'RESTRICTED_PAGE'
  | 'TAB_NOT_FOUND'
  | 'INVALID_URL'
  | 'CHROME_API_ERROR'

export interface RuntimeResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code: ErrorCode
    message: string
  }
}
