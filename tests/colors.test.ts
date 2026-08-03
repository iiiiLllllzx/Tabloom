import { colorForKey, stableHash } from '../src/lib/colors'
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
})
