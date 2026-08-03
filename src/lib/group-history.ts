import {
  getGroupHistory,
  getManualPreferences,
  recordGroupingSnapshot,
  replaceGroupHistory,
  restoreManualPreferences,
} from './storage'
import type {
  GroupHistoryStatus,
  GroupingSnapshot,
  ManualTabPreference,
} from '../types'

const UNGROUPED_ID = chrome.tabGroups.TAB_GROUP_ID_NONE
const MAX_UNDO_STEPS = 20

function toNonEmptyIds(tabIds: number[]): [number, ...number[]] | undefined {
  return tabIds.length > 0 ? (tabIds as [number, ...number[]]) : undefined
}

export async function captureGroupingSnapshot(windowId: number): Promise<GroupingSnapshot> {
  const [tabs, groups, preferences] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
    getManualPreferences(),
  ])
  const tabIdsByGroup = new Map<number, number[]>()
  const ungroupedTabIds: number[] = []
  const manualPreferences: Record<string, ManualTabPreference> = {}

  for (const tab of tabs) {
    if (tab.id === undefined) continue
    const preference = preferences[String(tab.id)]
    if (preference) {
      manualPreferences[String(tab.id)] = preference
    }
    if (tab.groupId === UNGROUPED_ID) {
      ungroupedTabIds.push(tab.id)
    } else {
      const tabIds = tabIdsByGroup.get(tab.groupId) ?? []
      tabIds.push(tab.id)
      tabIdsByGroup.set(tab.groupId, tabIds)
    }
  }

  return {
    windowId,
    createdAt: Date.now(),
    groups: groups.map((group) => ({
      title: group.title || '',
      color: group.color,
      collapsed: group.collapsed,
      tabIds: tabIdsByGroup.get(group.id) ?? [],
    })),
    ungroupedTabIds,
    manualPreferences,
  }
}

export async function saveUndoPoint(windowId: number): Promise<void> {
  await recordGroupingSnapshot(await captureGroupingSnapshot(windowId))
}

export async function applyGroupingSnapshot(snapshot: GroupingSnapshot): Promise<void> {
  const currentTabs = await chrome.tabs.query({ windowId: snapshot.windowId })
  const currentTabIds = new Set(
    currentTabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
  )
  const snapshotTabIds = [
    ...snapshot.ungroupedTabIds,
    ...snapshot.groups.flatMap((group) => group.tabIds),
  ].filter((tabId) => currentTabIds.has(tabId))

  const groupedSnapshotTabIds = currentTabs.flatMap((tab) =>
    tab.id !== undefined &&
    snapshotTabIds.includes(tab.id) &&
    tab.groupId !== UNGROUPED_ID
      ? [tab.id]
      : [],
  )
  const groupedIds = toNonEmptyIds(groupedSnapshotTabIds)
  if (groupedIds) {
    await chrome.tabs.ungroup(groupedIds)
  }

  for (const group of snapshot.groups) {
    const tabIds = toNonEmptyIds(group.tabIds.filter((tabId) => currentTabIds.has(tabId)))
    if (!tabIds) continue
    const groupId = await chrome.tabs.group({
      tabIds,
      createProperties: { windowId: snapshot.windowId },
    })
    await chrome.tabGroups.update(groupId, {
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
    })
  }

  await restoreManualPreferences(snapshotTabIds, snapshot.manualPreferences)
}

export async function undoGrouping(windowId: number): Promise<void> {
  const history = await getGroupHistory(windowId)
  const target = history.undoStack.at(-1)
  if (!target) {
    throw new Error('没有可撤销的分组操作')
  }
  await applyGroupingSnapshot(target)
  await replaceGroupHistory(windowId, {
    baseline: history.baseline,
    undoStack: history.undoStack.slice(0, -1),
  })
}

export async function restoreInitialGrouping(windowId: number): Promise<void> {
  const history = await getGroupHistory(windowId)
  if (!history.baseline) {
    throw new Error('还没有可恢复的初始分组')
  }
  const current = await captureGroupingSnapshot(windowId)
  await applyGroupingSnapshot(history.baseline)
  await replaceGroupHistory(windowId, {
    baseline: history.baseline,
    undoStack: [...history.undoStack, current].slice(-MAX_UNDO_STEPS),
  })
}

export async function getGroupHistoryStatus(windowId: number): Promise<GroupHistoryStatus> {
  const history = await getGroupHistory(windowId)
  return {
    canUndo: history.undoStack.length > 0,
    canRestore: history.baseline !== undefined,
  }
}
