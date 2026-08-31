import {
  createWindowSwitcherKeyboardCapture,
  WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS,
} from '../src/lib/window-switcher-capture'

function dispatchKey(
  type: 'keydown' | 'keyup',
  key: string,
  modifiers: Partial<Pick<KeyboardEventInit, 'metaKey' | 'ctrlKey' | 'shiftKey'>> = {},
) {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  })
  window.dispatchEvent(event)
  return event
}

describe('窗口切换器键盘抢占', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('激活后在 window capture 阶段吞掉方向键的 keydown 和 keyup', () => {
    const onNavigate = vi.fn()
    const webShellHandler = vi.fn()
    const capture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen: vi.fn(),
      onNavigate,
    })
    capture.setActive(true)
    window.addEventListener('keydown', webShellHandler)
    window.addEventListener('keyup', webShellHandler)

    const keydown = dispatchKey('keydown', 'ArrowUp')
    const keyup = dispatchKey('keyup', 'ArrowUp')

    expect(keydown.defaultPrevented).toBe(true)
    expect(keyup.defaultPrevented).toBe(true)
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenCalledWith('ArrowUp')
    expect(webShellHandler).not.toHaveBeenCalled()

    window.removeEventListener('keydown', webShellHandler)
    window.removeEventListener('keyup', webShellHandler)
    capture.dispose()
  })

  it('回车后释放会话，但仍吞掉对应的 keyup', () => {
    const onNavigate = vi.fn()
    const capture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen: vi.fn(),
      onNavigate,
    })
    capture.setActive(true)

    const keydown = dispatchKey('keydown', 'Enter')
    expect(capture.isActive()).toBe(false)
    const keyup = dispatchKey('keyup', 'Enter')
    const nextArrow = dispatchKey('keydown', 'ArrowDown')

    expect(keydown.defaultPrevented).toBe(true)
    expect(keyup.defaultPrevented).toBe(true)
    expect(nextArrow.defaultPrevented).toBe(false)
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenCalledWith('Enter')
    capture.dispose()
  })

  it('快捷键 keydown 激活并打开切换器，keyup 不重复打开', () => {
    const onOpen = vi.fn()
    const capture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen,
      onNavigate: vi.fn(),
    })

    dispatchKey('keydown', 'k', { metaKey: true, shiftKey: true })
    dispatchKey('keyup', 'k', { metaKey: true, shiftKey: true })

    expect(capture.isActive()).toBe(true)
    expect(onOpen).toHaveBeenCalledOnce()
    capture.dispose()
  })

  it('安全超时后自动释放键盘抢占', async () => {
    const capture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen: vi.fn(),
      onNavigate: vi.fn(),
    })
    capture.setActive(true)

    await vi.advanceTimersByTimeAsync(WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS)

    expect(capture.isActive()).toBe(false)
    expect(dispatchKey('keydown', 'ArrowDown').defaultPrevented).toBe(false)
    capture.dispose()
  })

  it('每次方向键操作都会刷新安全超时', async () => {
    const capture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen: vi.fn(),
      onNavigate: vi.fn(),
    })
    capture.setActive(true)

    await vi.advanceTimersByTimeAsync(
      WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS - 1_000,
    )
    dispatchKey('keydown', 'ArrowDown')
    dispatchKey('keyup', 'ArrowDown')
    await vi.advanceTimersByTimeAsync(1_500)

    expect(capture.isActive()).toBe(true)
    capture.dispose()
  })
})
