import {
  buildContrastingColorPlan,
  colorForKey,
  stableHash,
} from '../src/lib/colors'
import { GROUP_COLORS } from '../src/types'

describe('颜色映射', () => {
  it('对相同域名始终返回相同颜色', () => {
    expect(colorForKey('merlin.bytedance.net')).toBe(colorForKey('merlin.bytedance.net'))
    expect(stableHash('merlin.bytedance.net')).toBe(stableHash('merlin.bytedance.net'))
  })

  it('仅返回 Chrome 支持的标签组颜色', () => {
    const samples = [
      'merlin.bytedance.net',
      'docs.bytedance.net',
      'github.com',
      'example.org',
    ]
    for (const sample of samples) {
      expect(GROUP_COLORS).toContain(colorForKey(sample))
    }
  })

  it('能将一批域名分布到多个颜色', () => {
    const colors = new Set(
      Array.from({ length: 30 }, (_, index) => colorForKey(`host-${index}.example.com`)),
    )
    expect(colors.size).toBeGreaterThan(3)
  })

  it('相邻分组按高对比顺序轮用全部九色', () => {
    const keys = Array.from({ length: 18 }, (_, index) => `group-${index}`)
    const plan = buildContrastingColorPlan(keys)
    const colors = keys.map((key) => plan.get(key))
    const lowContrastPairs = new Set([
      'blue:cyan',
      'cyan:blue',
      'orange:yellow',
      'yellow:orange',
      'orange:red',
      'red:orange',
      'red:pink',
      'pink:red',
      'pink:purple',
      'purple:pink',
    ])

    expect(new Set(colors.slice(0, GROUP_COLORS.length)).size).toBe(
      GROUP_COLORS.length,
    )
    colors.slice(1).forEach((color, index) => {
      const previous = colors[index]
      expect(color).not.toBe(previous)
      expect(lowContrastPairs).not.toContain(`${previous}:${color}`)
    })
  })

  it('相同标签顺序生成稳定配色', () => {
    const keys = ['first', 'second', 'third']
    expect([...buildContrastingColorPlan(keys)]).toEqual([
      ...buildContrastingColorPlan(keys),
    ])
  })
})
