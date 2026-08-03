import { normalizeGroupThreshold } from '../src/lib/storage'

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
