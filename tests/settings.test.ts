import { getSettings, normalizeGroupThreshold } from '../src/lib/storage'

describe('分组阈值', () => {
  it.each([
    [undefined, 3],
    [1, 2],
    [2.4, 2],
    [3, 3],
    [20, 20],
    [99, 20],
  ])('将 %s 规范化为 %s', (input, expected) => {
    expect(normalizeGroupThreshold(input)).toBe(expected)
  })
})

describe('自动整理设置迁移', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('将 v1.5 关闭自动整理的状态迁移为开启', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 3,
              autoGroupEnabled: false,
              minTabsPerGroup: 3,
            },
          }),
          set,
        },
      },
    })

    await expect(getSettings()).resolves.toEqual({
      schemaVersion: 4,
      autoGroupEnabled: true,
      minTabsPerGroup: 3,
    })
    expect(set).toHaveBeenCalledWith({
      settings: {
        schemaVersion: 4,
        autoGroupEnabled: true,
        minTabsPerGroup: 3,
      },
    })
  })

  it('保留新版中用户主动关闭自动整理的选择', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              schemaVersion: 4,
              autoGroupEnabled: false,
              minTabsPerGroup: 4,
            },
          }),
          set,
        },
      },
    })

    await expect(getSettings()).resolves.toEqual({
      schemaVersion: 4,
      autoGroupEnabled: false,
      minTabsPerGroup: 4,
    })
    expect(set).not.toHaveBeenCalled()
  })
})
