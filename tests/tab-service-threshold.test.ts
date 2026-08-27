import type { GroupColor } from '../src/types'

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
              schemaVersion: 4,
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

  it('关闭标签后即使自动整理关闭也会解散低于阈值的已有自动组', async () => {
    const ungroup = vi.fn().mockResolvedValue(undefined)
    const move = vi.fn().mockResolvedValue([])
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([
          { id: 8, title: 'ml-bytedance', color: 'blue', collapsed: false },
        ]),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, index: 0, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/a' },
          { id: 2, index: 1, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/b' },
        ]),
        ungroup,
        move,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
              autoGroupEnabled: false,
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

    const { reconcileWindowAfterTabRemoved } = await import('../src/lib/tab-service')
    const ungroupedCount = await reconcileWindowAfterTabRemoved(10)

    expect(ungroup).toHaveBeenCalledWith([1, 2])
    expect(move).toHaveBeenCalledWith([1, 2], { index: -1 })
    expect(ungroupedCount).toBe(2)
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
              schemaVersion: 4,
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

  it('相同域名在两个窗口分别建组且不会跨窗口合并', async () => {
    const group = vi.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(102)
    const tabsByWindow = new Map([
      [
        1,
        [1, 2, 3].map((id, index) => ({
          id,
          index,
          windowId: 1,
          groupId: -1,
          url: `https://ml.bytedance.net/window-1/${id}`,
        })),
      ],
      [
        2,
        [4, 5, 6].map((id, index) => ({
          id,
          index,
          windowId: 2,
          groupId: -1,
          url: `https://ml.bytedance.net/window-2/${id}`,
        })),
      ],
    ])
    vi.stubGlobal('chrome', {
      windows: {
        getAll: vi.fn().mockResolvedValue([
          { id: 1, type: 'normal' },
          { id: 2, type: 'normal' },
        ]),
      },
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        query: vi.fn(({ windowId }: { windowId: number }) =>
          Promise.resolve(tabsByWindow.get(windowId) ?? []),
        ),
        group,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
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

    const { autoGroupAllWindows } = await import('../src/lib/tab-service')
    await autoGroupAllWindows()

    expect(group).toHaveBeenNthCalledWith(1, {
      tabIds: [1, 2, 3],
      createProperties: { windowId: 1 },
    })
    expect(group).toHaveBeenNthCalledWith(2, {
      tabIds: [4, 5, 6],
      createProperties: { windowId: 2 },
    })
  })

  it('同一窗口并发整理时串行执行且只创建一个组', async () => {
    const tabs = [1, 2, 3].map((id, index) => ({
      id,
      index,
      windowId: 10,
      groupId: -1,
      url: `https://ml.bytedance.net/${id}`,
    }))
    const groups: Array<{
      id: number
      title: string
      color: GroupColor
      collapsed: boolean
    }> = []
    const group = vi.fn(async ({ tabIds }: { tabIds: number[] }) => {
      tabs.forEach((tab) => {
        if (tabIds.includes(tab.id)) tab.groupId = 8
      })
      groups.push({ id: 8, title: '', color: 'grey', collapsed: false })
      return 8
    })
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn(async () => groups.map((item) => ({ ...item }))),
        update: vi.fn(async (_groupId: number, changes: Partial<(typeof groups)[number]>) => {
          Object.assign(groups[0]!, changes)
        }),
      },
      tabs: {
        query: vi.fn(async () => tabs.map((tab) => ({ ...tab }))),
        group,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
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

    const { autoGroupWindow } = await import('../src/lib/tab-service')
    await Promise.all([autoGroupWindow(10), autoGroupWindow(10)])

    expect(group).toHaveBeenCalledOnce()
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
              schemaVersion: 4,
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

    expect(group).toHaveBeenNthCalledWith(1, {
      tabIds: [1, 2, 3],
      createProperties: { windowId: 10 },
    })
    expect(group).toHaveBeenNthCalledWith(2, {
      tabIds: [4, 5, 6],
      createProperties: { windowId: 10 },
    })
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

  it('只跳过手工标签，同组其他标签仍参与重复组归并', async () => {
    const group = vi.fn().mockResolvedValue(8)
    const tabs = [
      { id: 1, index: 0, windowId: 10, groupId: 8, url: 'https://bytedance.larkoffice.com/manual' },
      { id: 2, index: 1, windowId: 10, groupId: 8, url: 'https://bytedance.larkoffice.com/a' },
      { id: 3, index: 2, windowId: 10, groupId: 9, url: 'https://bytedance.larkoffice.com/b' },
      { id: 4, index: 3, windowId: 10, groupId: 9, url: 'https://bytedance.larkoffice.com/c' },
    ]
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([
          { id: 8, title: 'bytedance-larkoffice', color: 'blue', collapsed: false },
          { id: 9, title: 'bytedance-larkoffice', color: 'orange', collapsed: false },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        query: vi.fn().mockResolvedValue(tabs),
        group,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
              autoGroupEnabled: true,
              minTabsPerGroup: 3,
            },
          }),
        },
        session: {
          get: vi.fn().mockResolvedValue({
            manualPreferences: {
              '1': { tabId: 1, mode: 'manual-group', updatedAt: 1 },
            },
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })

    const { autoGroupWindow } = await import('../src/lib/tab-service')
    await autoGroupWindow(10)

    expect(group).toHaveBeenCalledWith({
      tabIds: [3, 4],
      groupId: 8,
    })
    expect(group.mock.calls.flatMap(([options]) => options.tabIds)).not.toContain(1)
  })

  it('阈值收缩只解组未手工移动的标签', async () => {
    const ungroup = vi.fn().mockResolvedValue(undefined)
    const move = vi.fn().mockResolvedValue([])
    const tabs = [
      { id: 1, index: 0, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/manual' },
      { id: 2, index: 1, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/a' },
      { id: 3, index: 2, windowId: 10, groupId: 8, url: 'https://ml.bytedance.net/b' },
    ]
    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        query: vi.fn().mockResolvedValue([
          { id: 8, title: 'ml-bytedance', color: 'blue', collapsed: false },
        ]),
      },
      tabs: {
        query: vi.fn().mockResolvedValue(tabs),
        ungroup,
        move,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
              autoGroupEnabled: false,
              minTabsPerGroup: 3,
            },
          }),
        },
        session: {
          get: vi.fn().mockResolvedValue({
            manualPreferences: {
              '1': { tabId: 1, mode: 'manual-group', updatedAt: 1 },
            },
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })

    const { reconcileWindowAfterTabRemoved } = await import('../src/lib/tab-service')
    await expect(reconcileWindowAfterTabRemoved(10)).resolves.toBe(2)

    expect(ungroup).toHaveBeenCalledWith([2, 3])
    expect(move).toHaveBeenCalledWith([2, 3], { index: -1 })
    expect(ungroup.mock.calls.flat()).not.toContain(1)
  })

  it('取消所有窗口分组但保留自动整理设置', async () => {
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
              schemaVersion: 4,
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
    expect(localSet).not.toHaveBeenCalled()
  })
})
