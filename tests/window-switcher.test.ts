import {
  isWindowSwitcherShortcut,
  openWindowSwitcherFromCommand,
} from '../src/lib/window-switcher'

describe('窗口切换器快捷键', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [{ key: 'k', metaKey: true, ctrlKey: false, shiftKey: true }, true],
    [{ key: 'K', metaKey: false, ctrlKey: true, shiftKey: true }, true],
    [{ key: 'k', metaKey: true, ctrlKey: false, shiftKey: false }, false],
    [{ key: 's', metaKey: true, ctrlKey: false, shiftKey: true }, false],
  ])('识别快捷键组合 %#', (event, expected) => {
    expect(isWindowSwitcherShortcut(event as KeyboardEvent)).toBe(expected)
  })

  it('Chrome 命令触发时同步调用当前窗口的 Side Panel', async () => {
    const open = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      sidePanel: { open },
    })

    const handled = openWindowSwitcherFromCommand(
      'open-window-switcher-v2',
      { id: 7, windowId: 42 } as chrome.tabs.Tab,
    )

    expect(handled).toBe(true)
    expect(open).toHaveBeenCalledWith({ windowId: 42 })
  })

  it('忽略其他命令', () => {
    const open = vi.fn()
    vi.stubGlobal('chrome', {
      sidePanel: { open },
    })

    expect(
      openWindowSwitcherFromCommand(
        'rename-current-tab',
        { id: 7, windowId: 42 } as chrome.tabs.Tab,
      ),
    ).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
