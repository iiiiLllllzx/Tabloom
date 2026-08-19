import { buildContrastingColorPlan, colorForKey } from './colors'
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
  MultiWindowGroupResult,
  TabCard,
  UngroupAllResult,
  WindowSummary,
  WorkspaceSnapshot,
} from '../types'

const UNGROUPED_ID = chrome.tabGroups.TAB_GROUP_ID_NONE
const windowGroupingQueues = new Map<number, Promise<void>>()

export async function autoGroupWindow(
  windowId: number,
  force = false,
): Promise<AutoGroupResult> {
  const previous = windowGroupingQueues.get(windowId) ?? Promise.resolve()
  let releaseQueue!: () => void
  const queueGate = new Promise<void>((resolve) => {
    releaseQueue = resolve
  })
  const queueTail = previous.catch(() => undefined).then(() => queueGate)
  windowGroupingQueues.set(windowId, queueTail)
  await previous.catch(() => undefined)

  try {
    return await autoGroupWindowUnlocked(windowId, force)
  } finally {
    releaseQueue()
    if (windowGroupingQueues.get(windowId) === queueTail) {
      windowGroupingQueues.delete(windowId)
    }
  }
}

async function autoGroupWindowUnlocked(
  windowId: number,
  force: boolean,
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
    automaticGroupIds,
  })
  const tabIndexById = new Map(
    tabs.flatMap((tab) => (tab.id === undefined ? [] : [[tab.id, tab.index] as const])),
  )
  const groupedBuckets = buckets
    .filter((bucket) => bucket.tabIds.length >= settings.minTabsPerGroup)
    .sort((left, right) => {
      const leftIndex = Math.min(...left.tabIds.map((tabId) => tabIndexById.get(tabId) ?? 0))
      const rightIndex = Math.min(...right.tabIds.map((tabId) => tabIndexById.get(tabId) ?? 0))
      return leftIndex - rightIndex
    })
  const colorPlan = buildContrastingColorPlan(
    groupedBuckets.map((bucket) => bucket.key),
  )
  const rightSideTabIds = buckets
    .filter((bucket) => bucket.tabIds.length < settings.minTabsPerGroup)
    .flatMap((bucket) => bucket.tabIds)
  const rightSideIdSet = new Set(rightSideTabIds)
  const rightSideIdsInCurrentOrder = tabs.flatMap((tab) =>
    tab.id !== undefined && rightSideIdSet.has(tab.id) ? [tab.id] : [],
  )
  const reusableGroups = new Map<string, number>()
  for (const groupId of automaticGroupIds) {
    const firstTab = tabs.find(
      (tab) =>
        tab.groupId === groupId &&
        tab.id !== undefined &&
        !effectivePreferences[String(tab.id)],
    )
    const hostname = extractHostname(firstTab?.url)
    if (hostname && !reusableGroups.has(getDomainGroupKey(hostname))) {
      reusableGroups.set(getDomainGroupKey(hostname), groupId)
    }
  }

  const groupChangesNeeded = groupedBuckets.some((bucket) => {
    const reusableGroupId = reusableGroups.get(bucket.key)
    const reusableGroup = groups.find((group) => group.id === reusableGroupId)
    const expectedColor = colorPlan.get(bucket.key) ?? colorForKey(bucket.key)
    return (
      reusableGroupId === undefined ||
      reusableGroup?.title !== bucket.title ||
      reusableGroup?.color !== expectedColor ||
      bucket.tabIds.some(
        (tabId) => tabs.find((tab) => tab.id === tabId)?.groupId !== reusableGroupId,
      )
    )
  })
  const groupedRightSideTabIds = rightSideIdsInCurrentOrder.filter(
    (tabId) => tabs.find((tab) => tab.id === tabId)?.groupId !== UNGROUPED_ID,
  )
  const currentTailIds = tabs
    .slice(Math.max(0, tabs.length - rightSideIdsInCurrentOrder.length))
    .flatMap((tab) => (tab.id === undefined ? [] : [tab.id]))
  const rightSideMoveNeeded =
    rightSideIdsInCurrentOrder.length > 0 &&
    (currentTailIds.length !== rightSideIdsInCurrentOrder.length ||
      currentTailIds.some((tabId, index) => tabId !== rightSideIdsInCurrentOrder[index]))
  const needsChanges =
    groupChangesNeeded || groupedRightSideTabIds.length > 0 || rightSideMoveNeeded
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
  let ungroupedTabs = 0
  let movedTabs = 0

  for (const bucket of groupedBuckets) {
    const reusableGroupId = reusableGroups.get(bucket.key)
    if (reusableGroupId !== undefined) {
      const reusableGroup = groups.find((group) => group.id === reusableGroupId)
      const movedTabIds = bucket.tabIds.filter(
        (tabId) => tabs.find((tab) => tab.id === tabId)?.groupId !== reusableGroupId,
      )
      const expectedColor = colorPlan.get(bucket.key) ?? colorForKey(bucket.key)
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
      const groupId = await chrome.tabs.group({
        tabIds: bucket.tabIds,
        createProperties: { windowId },
      })
      await chrome.tabGroups.update(groupId, {
        title: bucket.title,
        color: colorPlan.get(bucket.key) ?? colorForKey(bucket.key),
      })
      reusableGroups.set(bucket.key, groupId)
      createdGroups += 1
    }
    groupedTabs += bucket.tabIds.length
  }

  if (groupedRightSideTabIds.length > 0) {
    await chrome.tabs.ungroup(
      groupedRightSideTabIds as [number, ...number[]],
    )
    ungroupedTabs = groupedRightSideTabIds.length
  }
  if (rightSideMoveNeeded) {
    await chrome.tabs.move(
      rightSideIdsInCurrentOrder as [number, ...number[]],
      { index: -1 },
    )
    movedTabs = rightSideIdsInCurrentOrder.length
  }

  return {
    groupedTabs,
    ungroupedTabs,
    movedTabs,
    createdGroups,
    reusedGroups,
  }
}

async function getNormalWindowIds(): Promise<number[]> {
  const windows = await chrome.windows.getAll()
  return windows.flatMap((window) =>
    window.id !== undefined && (window.type === undefined || window.type === 'normal')
      ? [window.id]
      : [],
  )
}

export async function autoGroupAllWindows(): Promise<MultiWindowGroupResult> {
  const windowIds = await getNormalWindowIds()
  const result: MultiWindowGroupResult = {
    processedWindows: windowIds.length,
    groupedTabs: 0,
    ungroupedTabs: 0,
    movedTabs: 0,
    createdGroups: 0,
    reusedGroups: 0,
  }
  for (const windowId of windowIds) {
    const windowResult = await autoGroupWindow(windowId)
    result.groupedTabs += windowResult.groupedTabs
    result.ungroupedTabs += windowResult.ungroupedTabs
    result.movedTabs += windowResult.movedTabs
    result.createdGroups += windowResult.createdGroups
    result.reusedGroups += windowResult.reusedGroups
  }
  return result
}

export async function ungroupAllWindows(): Promise<UngroupAllResult> {
  const windowIds = await getNormalWindowIds()
  let ungroupedTabs = 0
  for (const windowId of windowIds) {
    const tabs = await chrome.tabs.query({ windowId })
    const groupedTabIds = tabs.flatMap((tab) =>
      tab.id !== undefined && tab.groupId !== UNGROUPED_ID ? [tab.id] : [],
    )
    if (groupedTabIds.length > 0) {
      await saveUndoPoint(windowId)
    }
    await clearManualPreferences(
      tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
    )
    if (groupedTabIds.length === 0) continue
    await chrome.tabs.ungroup(groupedTabIds as [number, ...number[]])
    ungroupedTabs += groupedTabIds.length
  }
  return { processedWindows: windowIds.length, ungroupedTabs }
}

export async function reconcileWindowAfterTabRemoved(windowId: number): Promise<number> {
  const [tabs, groups, preferences, settings] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
    getManualPreferences(),
    getSettings(),
  ])
  const automaticGroupIds = findAutomaticGroupIds(tabs, groups, preferences)
  const tabCountByGroup = new Map<number, number>()
  for (const tab of tabs) {
    if (
      tab.id !== undefined &&
      automaticGroupIds.has(tab.groupId) &&
      !preferences[String(tab.id)]
    ) {
      tabCountByGroup.set(tab.groupId, (tabCountByGroup.get(tab.groupId) ?? 0) + 1)
    }
  }
  const tabIdsToUngroup = tabs.flatMap((tab) =>
    tab.id !== undefined &&
    automaticGroupIds.has(tab.groupId) &&
    !preferences[String(tab.id)] &&
    (tabCountByGroup.get(tab.groupId) ?? 0) < settings.minTabsPerGroup
      ? [tab.id]
      : [],
  )
  if (tabIdsToUngroup.length === 0) {
    return 0
  }

  await saveUndoPoint(windowId)
  await chrome.tabs.ungroup(tabIdsToUngroup as [number, ...number[]])
  await chrome.tabs.move(tabIdsToUngroup as [number, ...number[]], { index: -1 })
  return tabIdsToUngroup.length
}

function findAutomaticGroupIds(
  tabs: chrome.tabs.Tab[],
  groups: chrome.tabGroups.TabGroup[],
  preferences: Record<string, { mode: string }>,
): Set<number> {
  const automaticGroupIds = new Set<number>()
  for (const group of groups) {
    const groupTabs = tabs.filter((tab) => tab.groupId === group.id)
    const automaticTabs = groupTabs.filter(
      (tab) => tab.id !== undefined && !preferences[String(tab.id)],
    )
    if (automaticTabs.length === 0) {
      continue
    }
    const hostnames = automaticTabs
      .map((tab) => extractHostname(tab.url))
      .filter((hostname): hostname is string => hostname !== undefined)
    const keys = new Set(hostnames.map(getDomainGroupKey))
    if (
      hostnames.length === automaticTabs.length &&
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
