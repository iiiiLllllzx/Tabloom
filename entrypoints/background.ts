import {
  clearTitleOverride,
  getSettings,
  getTitleOverride,
  setTitleOverride,
  updateSettings,
} from '../src/lib/storage'
import {
  autoGroupAllWindows,
  autoGroupWindow,
  createGroupWithTab,
  getWorkspace,
  moveTabToGroup,
  reconcileWindowAfterTabRemoved,
  ungroupAllWindows,
  ungroupTab,
} from '../src/lib/tab-service'
import {
  restoreInitialGrouping,
  undoGrouping,
} from '../src/lib/group-history'
import { handleRemovedTab } from '../src/lib/tab-events'
import {
  ensureContentScript,
  sendToTabWithInjection,
} from '../src/lib/content-messenger'
import { createAutoGroupScheduler } from '../src/lib/auto-group-scheduler'
import { requestTitleFromTab } from '../src/lib/title-prompt'
import { openWindowSwitcherFromCommand } from '../src/lib/window-switcher'
import type { ContentRequest, ErrorCode, RuntimeRequest, RuntimeResponse } from '../src/types'

const MENU_ID = 'tabloom-rename-current-tab'
const windowSwitcherTabs = new Map<number, number>()
const { scheduleAutoGroup, scheduleAfterTabRemoved } =
  createAutoGroupScheduler({
    getSettings,
    autoGroupWindow,
    reconcileWindowAfterTabRemoved,
  })

function success<T>(data?: T): RuntimeResponse<T> {
  return { ok: true, data }
}

function failure(error: unknown): RuntimeResponse {
  const message = error instanceof Error ? error.message : 'Chrome API 调用失败'
  const restricted =
    message.includes('Cannot access') ||
    message.includes('chrome://') ||
    message.includes('此页面受 Chrome 限制')
  const code: ErrorCode = restricted ? 'RESTRICTED_PAGE' : 'CHROME_API_ERROR'
  return {
    ok: false,
    error: {
      code,
      message: restricted ? '此页面受 Chrome 限制，无法修改标题。' : message,
    },
  }
}

async function sendToTab(tabId: number, request: ContentRequest): Promise<void> {
  await sendToTabWithInjection(tabId, request)
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error('找不到当前标签页')
  }
  return tab
}

async function promptTab(tabId?: number): Promise<void> {
  const targetId = tabId ?? (await getActiveTab()).id
  if (targetId === undefined) {
    throw new Error('找不到当前标签页')
  }
  const override = await getTitleOverride(targetId)
  const title = await requestTitleFromTab(targetId, override?.title ?? '')
  if (title === null) return

  await setTitleOverride(targetId, title)
  await sendToTab(targetId, { type: 'CONTENT_APPLY_TITLE', title })
}

async function openSidePanel(windowId?: number): Promise<void> {
  if (windowId !== undefined) {
    await chrome.sidePanel.open({ windowId })
    return
  }
  const currentWindow = await chrome.windows.getLastFocused()
  if (currentWindow.id !== undefined) {
    await chrome.sidePanel.open({ windowId: currentWindow.id })
  }
}

async function setWindowSwitcherMode(
  windowId: number,
  active: boolean,
  tabId?: number,
): Promise<void> {
  let targetTabId = tabId ?? windowSwitcherTabs.get(windowId)
  if (active && targetTabId === undefined) {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId })
    targetTabId = activeTab?.id
  }
  if (targetTabId === undefined) return

  if (active) {
    windowSwitcherTabs.set(windowId, targetTabId)
  } else {
    windowSwitcherTabs.delete(windowId)
  }
  await sendToTab(targetTabId, {
    type: 'CONTENT_WINDOW_SWITCHER_MODE',
    active,
  })
}

async function handleRequest(
  request: RuntimeRequest,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  try {
    switch (request.type) {
      case 'TITLE_CONTENT_READY': {
        const tabId = sender.tab?.id
        return success(tabId === undefined ? undefined : await getTitleOverride(tabId))
      }
      case 'TITLE_GET':
        return success(await getTitleOverride(request.tabId))
      case 'TITLE_SET': {
        const tabId = request.tabId ?? sender.tab?.id
        const title = request.title.trim()
        if (tabId === undefined) throw new Error('找不到当前标签页')
        if (!title) throw new Error('标题不能为空')
        const override = await setTitleOverride(tabId, title)
        await sendToTab(tabId, { type: 'CONTENT_APPLY_TITLE', title })
        return success(override)
      }
      case 'TITLE_CLEAR':
        await clearTitleOverride(request.tabId)
        await sendToTab(request.tabId, { type: 'CONTENT_CLEAR_TITLE' })
        return success()
      case 'TITLE_PROMPT':
        await promptTab(request.tabId)
        return success()
      case 'SETTINGS_GET':
        return success(await getSettings())
      case 'SETTINGS_UPDATE':
        return success(await updateSettings(request.settings))
      case 'GROUP_AUTO':
        return success(await autoGroupWindow(request.windowId, request.force))
      case 'GROUP_AUTO_ALL':
        return success(await autoGroupAllWindows())
      case 'GROUP_UNGROUP_ALL':
        return success(await ungroupAllWindows())
      case 'GROUP_MOVE':
        await moveTabToGroup(request.tabId, request.groupId)
        return success()
      case 'GROUP_CREATE':
        return success(
          await createGroupWithTab(
            request.tabId,
            request.windowId,
            request.title,
            request.color,
          ),
        )
      case 'GROUP_UNGROUP':
        await ungroupTab(request.tabId)
        return success()
      case 'GROUP_UNDO':
        await undoGrouping(request.windowId)
        return success()
      case 'GROUP_RESTORE':
        await restoreInitialGrouping(request.windowId)
        return success()
      case 'GROUP_UPDATE':
        await chrome.tabGroups.update(request.groupId, request.changes)
        return success()
      case 'WORKSPACE_GET':
        return success(await getWorkspace(request.windowId))
      case 'TAB_ACTIVATE':
        await chrome.windows.update(request.windowId, { focused: true })
        await chrome.tabs.update(request.tabId, { active: true })
        return success()
      case 'TAB_CLOSE':
        await chrome.tabs.remove(request.tabId)
        return success()
      case 'SIDEPANEL_OPEN':
        if (sender.tab?.id !== undefined) {
          windowSwitcherTabs.set(sender.tab.windowId, sender.tab.id)
        }
        await openSidePanel(sender.tab?.windowId)
        return success()
      case 'SIDEPANEL_READY':
        await setWindowSwitcherMode(request.windowId, true).catch(() => undefined)
        return success()
      case 'SIDEPANEL_CLOSED':
        await setWindowSwitcherMode(request.windowId, false).catch(() => undefined)
        return success()
      case 'SIDEPANEL_KEY':
        return success()
      default:
        return failure(new Error('未知消息类型'))
    }
  } catch (error) {
    return failure(error)
  }
}

async function ensureContextMenu(): Promise<void> {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '重命名当前标签页',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  })
}

async function ensureSidePanel(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    await chrome.sidePanel.setOptions({
      path: 'sidepanel.html',
      enabled: true,
    })
  } catch {
    // sidePanel may not be available on older Chrome versions
  }
}

async function ensureContentScriptsOnOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({})
  await Promise.allSettled(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [ensureContentScript(tab.id)],
    ),
  )
}

export default defineBackground(() => {
  // Manual extension reloads do not reliably emit onInstalled.
  void ensureContentScriptsOnOpenTabs()

  chrome.runtime.onInstalled.addListener(() => {
    void ensureContextMenu()
    void ensureSidePanel()
    void ensureContentScriptsOnOpenTabs()
  })
  chrome.runtime.onStartup.addListener(() => {
    void ensureContextMenu()
    void ensureSidePanel()
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.id !== undefined) {
      void promptTab(tab.id).catch(() => undefined)
    }
  })

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'rename-current-tab') {
      void promptTab(tab?.id).catch(() => undefined)
    } else {
      const handled = openWindowSwitcherFromCommand(command, tab)
      if (handled && tab?.id !== undefined) {
        void setWindowSwitcherMode(tab.windowId, true, tab.id).catch(
          () => undefined,
        )
      }
    }
  })

  chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse) => {
    void handleRequest(request, sender).then(sendResponse)
    return true
  })

  chrome.tabs.onCreated.addListener((tab) => {
    void scheduleAutoGroup(tab.windowId)
  })
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      void scheduleAutoGroup(tab.windowId)
    }
  })
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    void handleRemovedTab(tabId, removeInfo, scheduleAfterTabRemoved)
  })

  chrome.sidePanel.onClosed?.addListener(({ windowId }) => {
    void setWindowSwitcherMode(windowId, false).catch(() => undefined)
  })
})
