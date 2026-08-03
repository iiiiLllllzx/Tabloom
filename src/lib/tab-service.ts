import { colorForKey } from './colors'
import { buildDomainBuckets, extractHostname } from './domain'
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

  if (force) {
    await clearManualPreferences(
      tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
    )
  }

  const buckets = buildDomainBuckets(tabs, preferences, {
    force,
    includeSingleTabs: settings.groupSingleTabDomains,
  })
  const reusableGroups = new Map(
    groups
      .filter((group) => group.title)
      .map((group) => [group.title!.toLowerCase(), group.id]),
  )

  let createdGroups = 0
  let reusedGroups = 0
  let groupedTabs = 0

  for (const bucket of buckets) {
    const reusableGroupId = reusableGroups.get(bucket.hostname)
    if (reusableGroupId !== undefined) {
      await chrome.tabs.group({ tabIds: bucket.tabIds, groupId: reusableGroupId })
      reusedGroups += 1
    } else {
      const groupId = await chrome.tabs.group({ tabIds: bucket.tabIds })
      await chrome.tabGroups.update(groupId, {
        title: bucket.hostname,
        color: colorForKey(bucket.hostname),
      })
      reusableGroups.set(bucket.hostname, groupId)
      createdGroups += 1
    }
    groupedTabs += bucket.tabIds.length
  }

  return { groupedTabs, createdGroups, reusedGroups }
}

export async function moveTabToGroup(tabId: number, groupId: number): Promise<void> {
  await chrome.tabs.group({ tabIds: [tabId], groupId })
  await setManualPreference(tabId, 'manual-group')
}

export async function createGroupWithTab(
  tabId: number,
  windowId: number,
  title: string,
  color: GroupColor,
): Promise<number> {
  const groupId = await chrome.tabs.group({
    tabIds: [tabId],
    createProperties: { windowId },
  })
  await chrome.tabGroups.update(groupId, { title, color })
  await setManualPreference(tabId, 'manual-group')
  return groupId
}

export async function ungroupTab(tabId: number): Promise<void> {
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

  const [tabs, groups, overrides] = await Promise.all([
    chrome.tabs.query({ windowId: selectedWindow.id }),
    chrome.tabGroups.query({ windowId: selectedWindow.id }),
    getTitleOverrides(),
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
  }
}
