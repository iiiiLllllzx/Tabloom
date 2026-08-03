import type { ManualTabPreference } from '../types'

export interface GroupableTab {
  id?: number
  url?: string
  pinned?: boolean
  groupId?: number
}

export interface DomainBucket {
  key: string
  title: string
  hostnames: string[]
  tabIds: [number, ...number[]]
}

export function extractHostname(url?: string): string | undefined {
  if (!url) {
    return undefined
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined
    }
    return parsed.hostname.toLowerCase()
  } catch {
    return undefined
  }
}

export function isRestrictedUrl(url?: string): boolean {
  return extractHostname(url) === undefined
}

export function getDomainGroupKey(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean)
  if (labels[0] === 'www' && labels.length > 2) {
    labels.shift()
  }
  return labels.slice(0, 2).join('-') || hostname.toLowerCase()
}

export function getDomainGroupTitle(url?: string): string | undefined {
  const hostname = extractHostname(url)
  return hostname ? getDomainGroupKey(hostname) : undefined
}

export function isLikelyDomainGroupTitle(
  title: string | undefined,
  hostname: string,
): boolean {
  if (!title) {
    return false
  }
  const normalizedTitle = title.trim().toLowerCase()
  const labels = hostname.toLowerCase().split('.').filter(Boolean)
  const key = getDomainGroupKey(hostname)
  return (
    normalizedTitle === hostname.toLowerCase() ||
    normalizedTitle === key ||
    normalizedTitle === labels[0] ||
    normalizedTitle === labels[1]
  )
}

export function buildDomainBuckets(
  tabs: GroupableTab[],
  manualPreferences: Record<string, ManualTabPreference>,
  options: {
    force: boolean
    includeSingleTabs: boolean
    automaticGroupIds?: ReadonlySet<number>
  },
): DomainBucket[] {
  const buckets = new Map<string, { hostnames: Set<string>; tabIds: number[] }>()

  for (const tab of tabs) {
    const groupId = tab.groupId ?? -1
    const isAutomaticGroup =
      groupId !== -1 && options.automaticGroupIds?.has(groupId)
    if (
      tab.id === undefined ||
      tab.pinned ||
      (groupId !== -1 && !isAutomaticGroup) ||
      (!options.force && manualPreferences[String(tab.id)])
    ) {
      continue
    }

    const hostname = extractHostname(tab.url)
    if (!hostname) {
      continue
    }

    const key = getDomainGroupKey(hostname)
    const bucket = buckets.get(key) ?? { hostnames: new Set<string>(), tabIds: [] }
    bucket.hostnames.add(hostname)
    bucket.tabIds.push(tab.id)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .filter(([, bucket]) => options.includeSingleTabs || bucket.tabIds.length > 1)
    .map(([key, bucket]) => ({
      key,
      title: key,
      hostnames: [...bucket.hostnames].sort(),
      tabIds: bucket.tabIds as [number, ...number[]],
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
}
