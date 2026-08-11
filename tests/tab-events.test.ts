describe('标签关闭事件', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('关闭标签后清理状态并重新计算原窗口', async () => {
    const scheduleWindow = vi.fn().mockResolvedValue(undefined)
    const sessionSet = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi
            .fn()
            .mockResolvedValueOnce({
              titleOverrides: {
                '7': { tabId: 7, title: 'test', updatedAt: 1 },
              },
            })
            .mockResolvedValueOnce({
              manualPreferences: {
                '7': { tabId: 7, mode: 'manual-group', updatedAt: 1 },
              },
            }),
          set: sessionSet,
        },
      },
    })
    const { handleRemovedTab } = await import('../src/lib/tab-events')

    await handleRemovedTab(
      7,
      { windowId: 42, isWindowClosing: false },
      scheduleWindow,
    )

    expect(scheduleWindow).toHaveBeenCalledWith(42)
    expect(sessionSet).toHaveBeenCalledWith({
      titleOverrides: {},
      manualPreferences: {},
    })
  })

  it('关闭整个窗口时不再调度分组', async () => {
    const scheduleWindow = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })
    const { handleRemovedTab } = await import('../src/lib/tab-events')

    await handleRemovedTab(
      7,
      { windowId: 42, isWindowClosing: true },
      scheduleWindow,
    )

    expect(scheduleWindow).not.toHaveBeenCalled()
  })
})
