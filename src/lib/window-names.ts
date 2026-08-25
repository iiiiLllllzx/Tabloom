const WINDOW_META_KEY = 'windowMeta'

export interface WindowMeta {
  name: string
  letter: string
  color: string
}

export const WINDOW_PALETTE = [
  '#2f6bd4', // blue
  '#d44a1b', // orange/red
  '#7b2bb0', // purple
  '#23734f', // green
  '#b8860b', // dark yellow
  '#0e7490', // cyan
  '#be123c', // rose
  '#4b5563', // slate
]

export async function getAllWindowMeta(): Promise<Record<number, WindowMeta>> {
  const stored = await chrome.storage.session.get(WINDOW_META_KEY)
  return (stored[WINDOW_META_KEY] as Record<number, WindowMeta>) ?? {}
}

export async function getWindowMeta(
  windowId: number,
): Promise<WindowMeta | undefined> {
  const all = await getAllWindowMeta()
  return all[windowId]
}

export async function setWindowMeta(
  windowId: number,
  meta: Partial<WindowMeta>,
): Promise<WindowMeta> {
  const all = await getAllWindowMeta()
  const current = all[windowId] ?? { name: '', letter: '?', color: WINDOW_PALETTE[0]! }
  const merged: WindowMeta = { ...current, ...meta }
  all[windowId] = merged
  await chrome.storage.session.set({ [WINDOW_META_KEY]: all })
  return merged
}

export async function clearWindowMeta(windowId: number): Promise<void> {
  const all = await getAllWindowMeta()
  delete all[windowId]
  await chrome.storage.session.set({ [WINDOW_META_KEY]: all })
}

export function assignLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}

export function assignColor(index: number): string {
  return WINDOW_PALETTE[index % WINDOW_PALETTE.length]!
}

export function buildDefaultName(letter: string): string {
  return `任务窗口 ${letter}`
}
