import { GROUP_COLORS, type GroupColor } from '../types'

export function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function colorForKey(value: string): GroupColor {
  return GROUP_COLORS[stableHash(value) % GROUP_COLORS.length] ?? 'grey'
}

export function buildContrastingColorPlan(
  orderedKeys: readonly string[],
): Map<string, GroupColor> {
  const plan = new Map<string, GroupColor>()
  const firstKey = orderedKeys[0]
  if (!firstKey) {
    return plan
  }

  const startIndex = stableHash(firstKey) % GROUP_COLORS.length
  orderedKeys.forEach((key, index) => {
    const colorIndex = (startIndex + index) % GROUP_COLORS.length
    plan.set(key, GROUP_COLORS[colorIndex] ?? 'grey')
  })
  return plan
}
