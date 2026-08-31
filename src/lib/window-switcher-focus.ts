export function createWindowSwitcherFocusGuard(document: Document) {
  let previousFocus: HTMLElement | null = null
  let focusSink: HTMLDivElement | null = null

  function activate(): void {
    if (focusSink) return

    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const root = document.body ?? document.documentElement
    if (!root) return

    focusSink = document.createElement('div')
    focusSink.tabIndex = -1
    focusSink.setAttribute('aria-hidden', 'true')
    focusSink.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;'
    root.appendChild(focusSink)
    focusSink.focus({ preventScroll: true })
  }

  function deactivate(): void {
    focusSink?.remove()
    focusSink = null

    if (previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true })
    }
    previousFocus = null
  }

  return {
    setActive(active: boolean): void {
      if (active) activate()
      else deactivate()
    },
    dispose: deactivate,
  }
}
