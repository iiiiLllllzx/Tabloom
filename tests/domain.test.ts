import {
  buildDomainBuckets,
  extractHostname,
  getDomainGroupKey,
  getDomainGroupTitle,
  isLikelyDomainGroupTitle,
  isRestrictedUrl,
} from '../src/lib/domain'
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

  it('使用域名前两段生成简短分组名', () => {
    expect(getDomainGroupTitle('https://ml.bytedance.net/workbench')).toBe(
      'ml-bytedance',
    )
    expect(getDomainGroupTitle('https://code.byted.org/project')).toBe('code-byted')
    expect(getDomainGroupKey('www.github.com')).toBe('github-com')
  })

  it('识别旧版完整域名组和过短域名组', () => {
    expect(isLikelyDomainGroupTitle('ml.bytedance.net', 'ml.bytedance.net')).toBe(true)
    expect(isLikelyDomainGroupTitle('bytedance', 'ml.bytedance.net')).toBe(true)
    expect(isLikelyDomainGroupTitle('ml-bytedance', 'ml.bytedance.net')).toBe(true)
    expect(isLikelyDomainGroupTitle('训练任务', 'ml.bytedance.net')).toBe(false)
  })

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
      { force: false },
    )

    expect(buckets).toEqual([
      {
        key: 'merlin-example',
        title: 'merlin-example',
        hostnames: ['merlin.example.com'],
        tabIds: [1, 2],
      },
    ])
  })

  it('强制整理时忽略手工偏好并保留所有域名桶', () => {
    const buckets = buildDomainBuckets(
      [
        { id: 1, url: 'https://one.example.com', groupId: -1 },
        { id: 2, url: 'https://pair.example.com/a', groupId: -1 },
        { id: 3, url: 'https://pair.example.com/b', groupId: -1 },
      ],
      {
        '2': { tabId: 2, mode: 'keep-ungrouped', updatedAt: 1 },
      },
      { force: true },
    )

    expect(buckets).toEqual([
      {
        key: 'one-example',
        title: 'one-example',
        hostnames: ['one.example.com'],
        tabIds: [1],
      },
      {
        key: 'pair-example',
        title: 'pair-example',
        hostnames: ['pair.example.com'],
        tabIds: [2, 3],
      },
    ])
  })

  it('将相同前两段但不同后缀的域名合并', () => {
    const buckets = buildDomainBuckets(
      [
        { id: 1, url: 'https://ml.bytedance.net/workbench', groupId: -1 },
        { id: 2, url: 'https://ml.bytedance.com/webshell', groupId: -1 },
      ],
      {},
      { force: false },
    )

    expect(buckets).toEqual([
      {
        key: 'ml-bytedance',
        title: 'ml-bytedance',
        hostnames: ['ml.bytedance.com', 'ml.bytedance.net'],
        tabIds: [1, 2],
      },
    ])
  })
})
