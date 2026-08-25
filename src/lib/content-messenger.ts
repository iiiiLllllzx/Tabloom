import type { ContentRequest } from '../types'

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js'
const pendingEnsureTasks = new Map<number, Promise<void>>()

export function isInjectableTabUrl(url?: string): boolean {
  if (!url) return false
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function isMissingReceiver(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Receiving end does not exist')
  )
}

export async function injectContentScript(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  if (!isInjectableTabUrl(tab.url ?? tab.pendingUrl)) {
    throw new Error('此页面受 Chrome 限制，无法修改标题。')
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  })
}

async function ensureContentScriptOnce(tabId: number): Promise<void> {
  try {
    const ping: ContentRequest = { type: 'CONTENT_PING' }
    const response = await chrome.tabs.sendMessage(tabId, ping)
    if (response?.ok === true) {
      return
    }
  } catch (error) {
    if (!isMissingReceiver(error)) throw error
  }
  await injectContentScript(tabId)
}

export function ensureContentScript(tabId: number): Promise<void> {
  const pendingTask = pendingEnsureTasks.get(tabId)
  if (pendingTask) {
    return pendingTask
  }

  const task = ensureContentScriptOnce(tabId).finally(() => {
    if (pendingEnsureTasks.get(tabId) === task) {
      pendingEnsureTasks.delete(tabId)
    }
  })
  pendingEnsureTasks.set(tabId, task)
  return task
}

export async function sendToTabWithInjection(
  tabId: number,
  request: ContentRequest,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, request)
    return
  } catch (error) {
    if (!isMissingReceiver(error)) throw error
  }

  await ensureContentScript(tabId)
  await chrome.tabs.sendMessage(tabId, request)
}
