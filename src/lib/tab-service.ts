import { colorForKey } from './colors'
import {
  buildDomainBuckets,
  extractHostname,
  getDomainGroupKey,
  isLikelyDomainGroupTitle,
} from './domain'
import { getGroupHistoryStatus, saveUndoPoint } from './group-history'
import {
  clearManualPreferences,
  getManualPreferences,
  getSettings,
  getTitleOverrides,
  setManualPreference,
} from './storage'
import type {
  AutoGroupResult,
  GroupColor,
  GroupColumn,
  TabCard,
  WindowSummary,
  WorkspaceSnapshot,
} from '../types'

const UNGROUPED_ID = chrome.tabGroups.TAB_GROUP_ID_NONE

export async function autoGroupWindow(
  windowId: number,
  force = false,
): Promise<AutoGroupResult> {
  const [tabs, groups, preferences, settings] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
    getManualPreferences(),
    getSettings(),
  ])

  const effectivePreferences = force ? {} : preferences
  const automaticGroupIds = findAutomaticGroupIds(tabs, groups, effectivePreferences)
  const buckets = buildDomainBuckets(tabs, effectivePreferences, {
    force,
    includeSingleTabs: settings.groupSingleTabDomains,
    automaticGroupIds,
  })
  const reusableGroups = new Map<string, number>()
  for (const groupId of automaticGroupIds) {
    const firstTab = tabs.find((tab) => tab.groupId === groupId)
    const hostname = extractHostname(firstTab?.url)
    if (hostname && !reusableGroups.has(getDomainGroupKey(hostname))) {
      reusableGroups.set(getDomainGroupKey(hostname), groupId)
    }
  }

  const needsChanges = buckets.some((bucket) => {
    const reusableGroupId = reusableGroups.get(bucket.key)
    const reusableGroup = groups.find((group) => group.id === reusableGroupId)
    const expectedColor = colorForKey(bucket.key)
    return (
      reusableGroupId === undefined ||
      reusableGroup?.title !== bucket.title ||
      reusableGroup?.color !== expectedColor ||
      bucket.tabIds.some(
        (tabId) => tabs.find((tab) => tab.id === tabId)?.groupId !== reusableGroupId,
      )
    )
  })
  if (needsChanges) {
    await saveUndoPoint(windowId)
    if (force) {
      await clearManualPreferences(
        tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
      )
    }
  }

  let createdGroups = 0
  let reusedGroups = 0
  let groupedTabs = 0

  for (const bucket of buckets) {
    const reusableGroupId = reusableGroups.get(bucket.key)
    if (reusableGroupId !== undefined) {
      const reusableGroup = groups.find((group) => group.id === reusableGroupId)
      const movedTabIds = bucket.tabIds.filter(
        (tabId) => tabs.find((tab) => tab.id === tabId)?.groupId !== reusableGroupId,
      )
      const expectedColor = colorForKey(bucket.key)
      const needsMetadataUpdate =
        reusableGroup?.title !== bucket.title || reusableGroup?.color !== expectedColor
      if (movedTabIds.length === 0 && !needsMetadataUpdate) {
        continue
      }
      if (movedTabIds.length > 0) {
        await chrome.tabs.group({
          tabIds: movedTabIds as [number, ...number[]],
          groupId: reusableGroupId,
        })
      }
      if (needsMetadataUpdate) {
        await chrome.tabGroups.update(reusableGroupId, {
          title: bucket.title,
          color: expectedColor,
        })
      }
      reusedGroups += 1
    } else {
      const groupId = await chrome.tabs.group({ tabIds: bucket.tabIds })
      await chrome.tabGroups.update(groupId, {
        title: bucket.title,
        color: colorForKey(bucket.key),
      })
      reusableGroups.set(bucket.key, groupId)
      createdGroups += 1
    }
    groupedTabs += bucket.tabIds.length
  }

  return { groupedTabs, createdGroups, reusedGroups }
}

function findAutomaticGroupIds(
  tabs: chrome.tabs.Tab[],
  groups: chrome.tabGroups.TabGroup[],
  preferences: Record<string, { mode: string }>,
): Set<number> {
  const automaticGroupIds = new Set<number>()
  for (const group of groups) {
    const groupTabs = tabs.filter((tab) => tab.groupId === group.id)
    if (
      groupTabs.length === 0 ||
      groupTabs.some((tab) => tab.id !== undefined && preferences[String(tab.id)])
    ) {
      continue
    }
    const hostnames = groupTabs
      .map((tab) => extractHostname(tab.url))
      .filter((hostname): hostname is string => hostname !== undefined)
    const keys = new Set(hostnames.map(getDomainGroupKey))
    if (
      hostnames.length === groupTabs.length &&
      keys.size === 1 &&
      hostnames.some((hostname) => isLikelyDomainGroupTitle(group.title, hostname))
    ) {
      automaticGroupIds.add(group.id)
    }
  }
  return automaticGroupIds
}

export async function moveTabToGroup(tabId: number, groupId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  if (tab.groupId === groupId) return
  await saveUndoPoint(tab.windowId)
  await chrome.tabs.group({ tabIds: [tabId], groupId })
  await setManualPreference(tabId, 'manual-group')
}

export async function createGroupWithTab(
  tabId: number,
  windowId: number,
  title: string,
  color: GroupColor,
): Promise<number> {
  await saveUndoPoint(windowId)
  const groupId = await chrome.tabs.group({
    tabIds: [tabId],
    createProperties: { windowId },
  })
  await chrome.tabGroups.update(groupId, { title, color })
  await setManualPreference(tabId, 'manual-group')
  return groupId
}

export async function ungroupTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  if (tab.groupId === UNGROUPED_ID) return
  await saveUndoPoint(tab.windowId)
  await setManualPreference(tabId, 'keep-ungrouped')
  await chrome.tabs.ungroup([tabId])
}

export async function getWorkspace(windowId?: number): Promise<WorkspaceSnapshot> {
  const windows = await chrome.windows.getAll({ populate: true })
  const validWindows = windows.filter(
    (window): window is chrome.windows.Window & { id: number } => window.id !== undefined,
  )

  const fallbackWindow = validWindows[0]
  if (!fallbackWindow) {
    throw new Error('没有可管理的 Chrome 窗口')
  }

  const selectedWindow =
    validWindows.find((window) => window.id === windowId) ??
    validWindows.find((window) => window.focused) ??
    fallbackWindow

  const [tabs, groups, overrides, history] = await Promise.all([
    chrome.tabs.query({ windowId: selectedWindow.id }),
    chrome.tabGroups.query({ windowId: selectedWindow.id }),
    getTitleOverrides(),
    getGroupHistoryStatus(selectedWindow.id),
  ])

  const groupMap = new Map<number, GroupColumn>()
  groupMap.set(UNGROUPED_ID, {
    id: 'ungrouped',
    windowId: selectedWindow.id,
    title: '未分组',
    color: 'neutral',
    collapsed: false,
    tabs: [],
  })

  for (const group of groups) {
    groupMap.set(group.id, {
      id: group.id,
      windowId: selectedWindow.id,
      title: group.title || '未命名分组',
      color: group.color,
      collapsed: group.collapsed,
      tabs: [],
    })
  }

  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue
    }
    const card: TabCard = {
      id: tab.id,
      windowId: selectedWindow.id,
      groupId: tab.groupId,
      title: tab.title || '无标题标签页',
      url: tab.url,
      hostname: extractHostname(tab.url),
      favIconUrl: tab.favIconUrl,
      active: tab.active,
      pinned: tab.pinned,
      customTitle: overrides[String(tab.id)]?.title,
    }
    const target = groupMap.get(tab.groupId) ?? groupMap.get(UNGROUPED_ID)
    target?.tabs.push(card)
  }

  const columns = [...groupMap.values()].sort((left, right) => {
    if (left.id === 'ungrouped') return -1
    if (right.id === 'ungrouped') return 1
    return left.id - right.id
  })
  const summaries: WindowSummary[] = validWindows.map((window) => ({
    id: window.id,
    focused: window.focused,
    tabCount: window.tabs?.length ?? 0,
  }))

  return {
    selectedWindowId: selectedWindow.id,
    windows: summaries,
    columns,
    history,
  }
}
