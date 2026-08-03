import type { ManualTabPreference } from '../types'

export interface GroupableTab {
  id?: number
  url?: string
  pinned?: boolean
  groupId?: number
}

export interface DomainBucket {
  hostname: string
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

export function buildDomainBuckets(
  tabs: GroupableTab[],
  manualPreferences: Record<string, ManualTabPreference>,
  options: { force: boolean; includeSingleTabs: boolean },
): DomainBucket[] {
  const buckets = new Map<string, number[]>()

  for (const tab of tabs) {
    if (
      tab.id === undefined ||
      tab.pinned ||
      (tab.groupId ?? -1) !== -1 ||
      (!options.force && manualPreferences[String(tab.id)])
    ) {
      continue
    }

    const hostname = extractHostname(tab.url)
    if (!hostname) {
      continue
    }

    const tabIds = buckets.get(hostname) ?? []
    tabIds.push(tab.id)
    buckets.set(hostname, tabIds)
  }

  return [...buckets.entries()]
    .filter(([, tabIds]) => options.includeSingleTabs || tabIds.length > 1)
    .map(([hostname, tabIds]) => ({
      hostname,
      tabIds: tabIds as [number, ...number[]],
    }))
    .sort((left, right) => left.hostname.localeCompare(right.hostname))
}
