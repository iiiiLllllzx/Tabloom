import { createWindowSwitcherFocusGuard } from '../src/lib/window-switcher-focus'

describe('窗口切换器焦点保护', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('激活时移走终端焦点，关闭后恢复', () => {
    const terminal = document.createElement('textarea')
    document.body.appendChild(terminal)
    terminal.focus()
    const guard = createWindowSwitcherFocusGuard(document)

    guard.setActive(true)

    expect(document.activeElement).not.toBe(terminal)
    expect(document.activeElement).toHaveAttribute('aria-hidden', 'true')

    guard.setActive(false)

    expect(document.activeElement).toBe(terminal)
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('重复激活不会覆盖原始焦点', () => {
    const terminal = document.createElement('textarea')
    document.body.appendChild(terminal)
    terminal.focus()
    const guard = createWindowSwitcherFocusGuard(document)

    guard.setActive(true)
    guard.setActive(true)
    guard.setActive(false)

    expect(document.activeElement).toBe(terminal)
  })

  it('激活期间字符键不会进入原终端输入框', () => {
    const terminal = document.createElement('textarea')
    terminal.addEventListener('keydown', (event) => {
      terminal.value += event.key
    })
    document.body.appendChild(terminal)
    terminal.focus()
    const guard = createWindowSwitcherFocusGuard(document)

    guard.setActive(true)
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'w',
        bubbles: true,
        cancelable: true,
      }),
    )
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(terminal.value).toBe('')
    guard.setActive(false)
  })
})
