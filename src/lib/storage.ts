import type {
  ExtensionSettings,
  GroupHistoryState,
  GroupingSnapshot,
  ManualPreferenceMode,
  ManualTabPreference,
  TabTitleOverride,
} from '../types'

const SETTINGS_KEY = 'settings'
const TITLE_OVERRIDES_KEY = 'titleOverrides'
const MANUAL_PREFERENCES_KEY = 'manualPreferences'
const GROUP_HISTORY_KEY = 'groupHistory'
const MAX_UNDO_STEPS = 20

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 4,
  autoGroupEnabled: true,
  minTabsPerGroup: 3,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  const saved = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined
  const savedVersion = saved?.schemaVersion ?? 0
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    autoGroupEnabled:
      savedVersion < 4 ? true : (saved?.autoGroupEnabled ?? true),
    minTabsPerGroup: normalizeGroupThreshold(saved?.minTabsPerGroup),
    schemaVersion: 4,
  }
  if (savedVersion < 4) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  }
  return settings
}

export async function updateSettings(
  changes: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings()
  const settings = {
    ...current,
    ...changes,
    minTabsPerGroup: normalizeGroupThreshold(
      changes.minTabsPerGroup ?? current.minTabsPerGroup,
    ),
    schemaVersion: 4 as const,
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  return settings
}

export function normalizeGroupThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.minTabsPerGroup
  }
  return Math.min(20, Math.max(2, Math.round(value!)))
}

export async function getTitleOverrides(): Promise<Record<string, TabTitleOverride>> {
  const stored = await chrome.storage.session.get(TITLE_OVERRIDES_KEY)
  return (stored[TITLE_OVERRIDES_KEY] as Record<string, TabTitleOverride> | undefined) ?? {}
}

export async function getTitleOverride(tabId: number): Promise<TabTitleOverride | undefined> {
  return (await getTitleOverrides())[String(tabId)]
}

export async function setTitleOverride(tabId: number, title: string): Promise<TabTitleOverride> {
  const overrides = await getTitleOverrides()
  const override = { tabId, title, updatedAt: Date.now() }
  overrides[String(tabId)] = override
  await chrome.storage.session.set({ [TITLE_OVERRIDES_KEY]: overrides })
  return override
}

export async function clearTitleOverride(tabId: number): Promise<void> {
  const overrides = await getTitleOverrides()
  delete overrides[String(tabId)]
  await chrome.storage.session.set({ [TITLE_OVERRIDES_KEY]: overrides })
}

export async function getManualPreferences(): Promise<Record<string, ManualTabPreference>> {
  const stored = await chrome.storage.session.get(MANUAL_PREFERENCES_KEY)
  return (
    (stored[MANUAL_PREFERENCES_KEY] as Record<string, ManualTabPreference> | undefined) ?? {}
  )
}

export async function setManualPreference(
  tabId: number,
  mode: ManualPreferenceMode,
): Promise<void> {
  const preferences = await getManualPreferences()
  preferences[String(tabId)] = { tabId, mode, updatedAt: Date.now() }
  await chrome.storage.session.set({ [MANUAL_PREFERENCES_KEY]: preferences })
}

export async function clearManualPreferences(tabIds: number[]): Promise<void> {
  const preferences = await getManualPreferences()
  for (const tabId of tabIds) {
    delete preferences[String(tabId)]
  }
  await chrome.storage.session.set({ [MANUAL_PREFERENCES_KEY]: preferences })
}

export async function restoreManualPreferences(
  tabIds: number[],
  restored: Record<string, ManualTabPreference>,
): Promise<void> {
  const preferences = await getManualPreferences()
  for (const tabId of tabIds) {
    delete preferences[String(tabId)]
    const restoredPreference = restored[String(tabId)]
    if (restoredPreference) {
      preferences[String(tabId)] = restoredPreference
    }
  }
  await chrome.storage.session.set({ [MANUAL_PREFERENCES_KEY]: preferences })
}

async function getAllGroupHistory(): Promise<Record<string, GroupHistoryState>> {
  const stored = await chrome.storage.session.get(GROUP_HISTORY_KEY)
  return (stored[GROUP_HISTORY_KEY] as Record<string, GroupHistoryState> | undefined) ?? {}
}

export async function getGroupHistory(windowId: number): Promise<GroupHistoryState> {
  const history = await getAllGroupHistory()
  return history[String(windowId)] ?? { undoStack: [] }
}

export async function recordGroupingSnapshot(snapshot: GroupingSnapshot): Promise<void> {
  const allHistory = await getAllGroupHistory()
  const current = allHistory[String(snapshot.windowId)] ?? { undoStack: [] }
  allHistory[String(snapshot.windowId)] = {
    baseline: current.baseline ?? snapshot,
    undoStack: [...current.undoStack, snapshot].slice(-MAX_UNDO_STEPS),
  }
  await chrome.storage.session.set({ [GROUP_HISTORY_KEY]: allHistory })
}

export async function replaceGroupHistory(
  windowId: number,
  state: GroupHistoryState,
): Promise<void> {
  const allHistory = await getAllGroupHistory()
  allHistory[String(windowId)] = state
  await chrome.storage.session.set({ [GROUP_HISTORY_KEY]: allHistory })
}

export async function clearTabState(tabId: number): Promise<void> {
  const [overrides, preferences] = await Promise.all([
    getTitleOverrides(),
    getManualPreferences(),
  ])
  delete overrides[String(tabId)]
  delete preferences[String(tabId)]
  await chrome.storage.session.set({
    [TITLE_OVERRIDES_KEY]: overrides,
    [MANUAL_PREFERENCES_KEY]: preferences,
  })
}
