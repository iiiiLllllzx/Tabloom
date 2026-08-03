import {
  clearTabState,
  clearTitleOverride,
  getSettings,
  getTitleOverride,
  setTitleOverride,
  updateSettings,
} from '../src/lib/storage'
import {
  autoGroupWindow,
  createGroupWithTab,
  getWorkspace,
  moveTabToGroup,
  ungroupTab,
} from '../src/lib/tab-service'
import type { ContentRequest, ErrorCode, RuntimeRequest, RuntimeResponse } from '../src/types'

const MENU_ID = 'tabloom-rename-current-tab'
const autoGroupTimers = new Map<number, ReturnType<typeof setTimeout>>()

function success<T>(data?: T): RuntimeResponse<T> {
  return { ok: true, data }
}

function failure(error: unknown): RuntimeResponse {
  const message = error instanceof Error ? error.message : 'Chrome API 调用失败'
  const restricted =
    message.includes('Receiving end does not exist') ||
    message.includes('Cannot access') ||
    message.includes('chrome://')
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
  await chrome.tabs.sendMessage(tabId, request)
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
  await sendToTab(targetId, {
    type: 'CONTENT_PROMPT_TITLE',
    initialValue: override?.title ?? '',
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

async function scheduleAutoGroup(windowId: number): Promise<void> {
  const settings = await getSettings()
  if (!settings.autoGroupEnabled) {
    return
  }

  const currentTimer = autoGroupTimers.get(windowId)
  if (currentTimer) {
    clearTimeout(currentTimer)
  }
  autoGroupTimers.set(
    windowId,
    setTimeout(() => {
      autoGroupTimers.delete(windowId)
      void autoGroupWindow(windowId).catch(() => undefined)
    }, 450),
  )
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void ensureContextMenu()
  })
  chrome.runtime.onStartup.addListener(() => {
    void ensureContextMenu()
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.id !== undefined) {
      void promptTab(tab.id).catch(() => undefined)
    }
  })

  chrome.commands.onCommand.addListener((command) => {
    if (command === 'rename-current-tab') {
      void promptTab().catch(() => undefined)
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
  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearTabState(tabId)
  })
})
