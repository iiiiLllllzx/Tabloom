import type {
  ExtensionSettings,
  ManualPreferenceMode,
  ManualTabPreference,
  TabTitleOverride,
} from '../types'

const SETTINGS_KEY = 'settings'
const TITLE_OVERRIDES_KEY = 'titleOverrides'
const MANUAL_PREFERENCES_KEY = 'manualPreferences'

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 1,
  autoGroupEnabled: true,
  groupSingleTabDomains: true,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined),
    schemaVersion: 1,
  }
}

export async function updateSettings(
  changes: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const settings = { ...(await getSettings()), ...changes, schemaVersion: 1 as const }
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  return settings
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
