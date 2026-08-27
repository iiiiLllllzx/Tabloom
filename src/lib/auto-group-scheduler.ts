import type { ExtensionSettings } from '../types'

interface AutoGroupSchedulerDependencies {
  getSettings: () => Promise<ExtensionSettings>
  autoGroupWindow: (windowId: number) => Promise<unknown>
  reconcileWindowAfterTabRemoved: (windowId: number) => Promise<unknown>
}

export function createAutoGroupScheduler(
  dependencies: AutoGroupSchedulerDependencies,
  delayMs = 450,
) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function replaceTimer(windowId: number, task: () => Promise<unknown>): void {
    const currentTimer = timers.get(windowId)
    if (currentTimer) clearTimeout(currentTimer)

    timers.set(
      windowId,
      setTimeout(() => {
        timers.delete(windowId)
        void task().catch(() => undefined)
      }, delayMs),
    )
  }

  async function scheduleAutoGroup(windowId: number): Promise<void> {
    const settings = await dependencies.getSettings()
    if (!settings.autoGroupEnabled) return

    replaceTimer(windowId, () => dependencies.autoGroupWindow(windowId))
  }

  async function scheduleAfterTabRemoved(windowId: number): Promise<void> {
    const settings = await dependencies.getSettings()
    replaceTimer(windowId, () =>
      settings.autoGroupEnabled
        ? dependencies.autoGroupWindow(windowId)
        : dependencies.reconcileWindowAfterTabRemoved(windowId),
    )
  }

  return {
    scheduleAutoGroup,
    scheduleAfterTabRemoved,
  }
}
