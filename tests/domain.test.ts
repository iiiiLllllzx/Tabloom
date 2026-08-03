import { buildDomainBuckets, extractHostname, isRestrictedUrl } from '../src/lib/domain'
import type { ManualTabPreference } from '../src/types'

describe('域名服务', () => {
  it('提取标准化主机名并忽略端口', () => {
    expect(extractHostname('https://MERLIN.ByteDance.NET:8443/jobs/42')).toBe(
      'merlin.bytedance.net',
    )
  })

  it.each(['chrome://extensions', 'file:///notes.txt', 'not a url', undefined])(
    '拒绝不可注入的 URL：%s',
    (url) => {
      expect(extractHostname(url)).toBeUndefined()
      expect(isRestrictedUrl(url)).toBe(true)
    },
  )

  it('仅收集未分组、非固定且无手工偏好的标签', () => {
    const preferences: Record<string, ManualTabPreference> = {
      '5': { tabId: 5, mode: 'keep-ungrouped', updatedAt: 1 },
    }
    const buckets = buildDomainBuckets(
      [
        { id: 1, url: 'https://merlin.example.com/a', groupId: -1 },
        { id: 2, url: 'https://merlin.example.com/b', groupId: -1 },
        { id: 3, url: 'https://docs.example.com', groupId: 10 },
        { id: 4, url: 'https://docs.example.com', groupId: -1, pinned: true },
        { id: 5, url: 'https://manual.example.com', groupId: -1 },
        { id: 6, url: 'chrome://settings', groupId: -1 },
      ],
      preferences,
      { force: false, includeSingleTabs: true },
    )

    expect(buckets).toEqual([
      { hostname: 'merlin.example.com', tabIds: [1, 2] },
    ])
  })

  it('强制整理时忽略手工偏好，并可排除单标签域名', () => {
    const buckets = buildDomainBuckets(
      [
        { id: 1, url: 'https://one.example.com', groupId: -1 },
        { id: 2, url: 'https://pair.example.com/a', groupId: -1 },
        { id: 3, url: 'https://pair.example.com/b', groupId: -1 },
      ],
      {
        '2': { tabId: 2, mode: 'keep-ungrouped', updatedAt: 1 },
      },
      { force: true, includeSingleTabs: false },
    )

    expect(buckets).toEqual([
      { hostname: 'pair.example.com', tabIds: [2, 3] },
    ])
  })
})
