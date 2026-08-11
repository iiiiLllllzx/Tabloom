import { clearTabState } from './storage'

interface RemovedTabInfo {
  windowId: number
  isWindowClosing: boolean
}

export async function handleRemovedTab(
  tabId: number,
  removeInfo: RemovedTabInfo,
  scheduleWindow: (windowId: number) => Promise<void>,
): Promise<void> {
  await clearTabState(tabId)
  if (!removeInfo.isWindowClosing) {
    await scheduleWindow(removeInfo.windowId)
  }
}
