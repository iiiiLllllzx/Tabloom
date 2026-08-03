import type { GroupingSnapshot } from '../src/types'

describe('分组历史恢复', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('仅恢复快照中仍然存在的标签，并保留后来新开的标签', async () => {
    const ungroup = vi.fn().mockResolvedValue(undefined)
    const group = vi.fn().mockResolvedValue(99)
    const update = vi.fn().mockResolvedValue(undefined)
    const storageGet = vi.fn().mockResolvedValue({ manualPreferences: {} })
    const storageSet = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('chrome', {
      tabGroups: {
        TAB_GROUP_ID_NONE: -1,
        update,
      },
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, groupId: 7 },
          { id: 2, groupId: -1 },
          { id: 3, groupId: 8 },
          { id: 4, groupId: 8 },
        ]),
        ungroup,
        group,
      },
      storage: {
        session: { get: storageGet, set: storageSet },
      },
    })

    const snapshot: GroupingSnapshot = {
      windowId: 10,
      createdAt: 1,
      groups: [
        {
          title: 'ml-bytedance',
          color: 'blue',
          collapsed: false,
          tabIds: [1, 2, 404],
        },
      ],
      ungroupedTabIds: [3],
      manualPreferences: {},
    }
    const { applyGroupingSnapshot } = await import('../src/lib/group-history')

    await applyGroupingSnapshot(snapshot)

    expect(ungroup).toHaveBeenCalledWith([1, 3])
    expect(group).toHaveBeenCalledWith({
      tabIds: [1, 2],
      createProperties: { windowId: 10 },
    })
    expect(update).toHaveBeenCalledWith(99, {
      title: 'ml-bytedance',
      color: 'blue',
      collapsed: false,
    })
    expect(ungroup.mock.calls.flat()).not.toContain(4)
  })
})
