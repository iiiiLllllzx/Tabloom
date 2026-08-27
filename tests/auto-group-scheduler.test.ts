import { createAutoGroupScheduler } from '../src/lib/auto-group-scheduler'

describe('自动分组事件调度', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('同一窗口连续创建或更新标签时只执行最后一次整理', async () => {
    const autoGroupWindow = vi.fn().mockResolvedValue(undefined)
    const scheduler = createAutoGroupScheduler({
      getSettings: vi.fn().mockResolvedValue({
        schemaVersion: 4,
        autoGroupEnabled: true,
        minTabsPerGroup: 3,
      }),
      autoGroupWindow,
      reconcileWindowAfterTabRemoved: vi.fn(),
    })

    await scheduler.scheduleAutoGroup(10)
    await scheduler.scheduleAutoGroup(10)
    await vi.advanceTimersByTimeAsync(450)

    expect(autoGroupWindow).toHaveBeenCalledTimes(1)
    expect(autoGroupWindow).toHaveBeenCalledWith(10)
  })

  it('自动整理关闭时不响应标签创建或更新', async () => {
    const autoGroupWindow = vi.fn()
    const scheduler = createAutoGroupScheduler({
      getSettings: vi.fn().mockResolvedValue({
        schemaVersion: 4,
        autoGroupEnabled: false,
        minTabsPerGroup: 3,
      }),
      autoGroupWindow,
      reconcileWindowAfterTabRemoved: vi.fn(),
    })

    await scheduler.scheduleAutoGroup(10)
    await vi.advanceTimersByTimeAsync(450)

    expect(autoGroupWindow).not.toHaveBeenCalled()
  })

  it('关闭标签后按开启状态重新整理窗口', async () => {
    const autoGroupWindow = vi.fn().mockResolvedValue(undefined)
    const reconcileWindowAfterTabRemoved = vi.fn()
    const scheduler = createAutoGroupScheduler({
      getSettings: vi.fn().mockResolvedValue({
        schemaVersion: 4,
        autoGroupEnabled: true,
        minTabsPerGroup: 3,
      }),
      autoGroupWindow,
      reconcileWindowAfterTabRemoved,
    })

    await scheduler.scheduleAfterTabRemoved(12)
    await vi.advanceTimersByTimeAsync(450)

    expect(autoGroupWindow).toHaveBeenCalledWith(12)
    expect(reconcileWindowAfterTabRemoved).not.toHaveBeenCalled()
  })

  it('自动整理关闭时仍清理低于阈值的已有自动组', async () => {
    const autoGroupWindow = vi.fn()
    const reconcileWindowAfterTabRemoved = vi.fn().mockResolvedValue(undefined)
    const scheduler = createAutoGroupScheduler({
      getSettings: vi.fn().mockResolvedValue({
        schemaVersion: 4,
        autoGroupEnabled: false,
        minTabsPerGroup: 3,
      }),
      autoGroupWindow,
      reconcileWindowAfterTabRemoved,
    })

    await scheduler.scheduleAfterTabRemoved(12)
    await vi.advanceTimersByTimeAsync(450)

    expect(reconcileWindowAfterTabRemoved).toHaveBeenCalledWith(12)
    expect(autoGroupWindow).not.toHaveBeenCalled()
  })
})
