describe('多窗口阈值分组服务', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未达到阈值时取消自动组并移到窗口最右侧', async () => {
    const ungroup = vi.fn().mockResolvedValue(undefined)
    const move = vi.fn().mockResolvedValue([])
    const storageSet = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([
          { id: 8, title: 'ml-bytedance', color: 'blue', collapsed: false },
        ]),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/a' },
          { id: 3, windowId: 10, groupId: -1, url: 'chrome://settings' },
          { id: 2, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/b' },
        ]),
        ungroup,
        move,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 2,
              autoGroupEnabled: true,
              minTabsPerGroup: 3,
            },
          }),
          set: storageSet,
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: storageSet,
        },
      },
    })

    const { autoGroupWindow } = await import('../src/lib/tab-service')
    const result = await autoGroupWindow(10)

    expect(ungroup).toHaveBeenCalledWith([1, 2])
    expect(move).toHaveBeenCalledWith([1, 2], { index: -1 })
    expect(result).toMatchObject({ groupedTabs: 0, ungroupedTabs: 2, movedTabs: 2 })
  })

  it('主动整理遍历所有普通窗口', async () => {
    vi.stubGlobal('chrome', {
      windows: {
        getAll: vi.fn().mockResolvedValue([
          { id: 1, type: 'normal' },
          { id: 2, type: 'normal' },
          { id: 3, type: 'popup' },
        ]),
      },
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([]),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 2,
              autoGroupEnabled: true,
              minTabsPerGroup: 3,
            },
          }),
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    })

    const { autoGroupAllWindows } = await import('../src/lib/tab-service')
    const result = await autoGroupAllWindows()

    expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 })
    expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 2 })
    expect(chrome.tabs.query).not.toHaveBeenCalledWith({ windowId: 3 })
    expect(result.processedWindows).toBe(2)
  })

  it('按照标签栏顺序为自动组分配相邻高对比色', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const group = vi
      .fn()
      .mockResolvedValueOnce(101)
      .mockResolvedValueOnce(102)
    const tabs = [
      { id: 1, index: 0, windowId: 10, groupId: -1, url: 'https://gitee.com/a' },
      { id: 2, index: 1, windowId: 10, groupId: -1, url: 'https://gitee.com/b' },
      { id: 3, index: 2, windowId: 10, groupId: -1, url: 'https://gitee.com/c' },
      { id: 4, index: 3, windowId: 10, groupId: -1, url: 'https://code.byted.org/a' },
      { id: 5, index: 4, windowId: 10, groupId: -1, url: 'https://code.byted.org/b' },
      { id: 6, index: 5, windowId: 10, groupId: -1, url: 'https://code.byted.org/c' },
    ]
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([]),
        update,
      },
      tabs: {
        query: vi.fn().mockResolvedValue(tabs),
        group,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 2,
              autoGroupEnabled: true,
              minTabsPerGroup: 3,
            },
          }),
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })

    const [{ autoGroupWindow }, { buildContrastingColorPlan }] = await Promise.all([
      import('../src/lib/tab-service'),
      import('../src/lib/colors'),
    ])
    const plan = buildContrastingColorPlan(['gitee-com', 'code-byted'])
    await autoGroupWindow(10)

    expect(update).toHaveBeenNthCalledWith(1, 101, {
      title: 'gitee-com',
      color: plan.get('gitee-com'),
    })
    expect(update).toHaveBeenNthCalledWith(2, 102, {
      title: 'code-byted',
      color: plan.get('code-byted'),
    })
    expect(plan.get('gitee-com')).not.toBe(plan.get('code-byted'))
  })

  it('取消所有窗口分组并关闭自动整理', async () => {
    const ungroup = vi.fn().mockResolvedValue(undefined)
    const localSet = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      windows: {
        getAll: vi.fn().mockResolvedValue([
          { id: 1, type: 'normal' },
          { id: 2, type: 'normal' },
        ]),
      },
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([
          { id: 8, title: 'ml-bytedance', color: 'blue', collapsed: false },
        ]),
      },
      tabs: {
        query: vi.fn(({ windowId }: { windowId: number }) =>
          Promise.resolve(
            windowId === 1
              ? [{ id: 1, windowId: 1, groupId: 8 }]
              : [{ id: 2, windowId: 2, groupId: -1 }],
          ),
        ),
        ungroup,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 2,
              autoGroupEnabled: true,
              minTabsPerGroup: 3,
            },
          }),
          set: localSet,
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })

    const { ungroupAllWindows } = await import('../src/lib/tab-service')
    const result = await ungroupAllWindows()

    expect(ungroup).toHaveBeenCalledWith([1])
    expect(result).toEqual({ processedWindows: 2, ungroupedTabs: 1 })
    expect(localSet).toHaveBeenCalledWith({
      settings: {
        schemaVersion: 2,
        autoGroupEnabled: false,
        minTabsPerGroup: 3,
      },
    })
  })
})
