import type {
  ContentRequest,
  RuntimeRequest,
  RuntimeResponse,
  TabTitleOverride,
} from '../src/types'
import { isWindowSwitcherShortcut } from '../src/lib/window-switcher'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    let customTitle: string | undefined
    let latestSiteTitle = ''
    let applyingOverride = false

    function applyTitle(title: string): void {
      if (!document.title) {
        latestSiteTitle = latestSiteTitle || ''
      } else if (document.title !== customTitle) {
        latestSiteTitle = document.title
      }
      customTitle = title
      applyingOverride = true
      document.title = title
      queueMicrotask(() => {
        applyingOverride = false
      })
    }

    function clearTitle(): void {
      customTitle = undefined
      if (latestSiteTitle) {
        document.title = latestSiteTitle
      }
    }

    function handleWindowSwitcherShortcut(event: KeyboardEvent): void {
      if (isWindowSwitcherShortcut(event)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const request: RuntimeRequest = { type: 'SIDEPANEL_OPEN' }
        void chrome.runtime.sendMessage(request)
      }
    }

    const observer = new MutationObserver(() => {
      if (!customTitle || applyingOverride) {
        return
      }
      if (document.title !== customTitle) {
        latestSiteTitle = document.title
        applyTitle(customTitle)
      }
    })

    function observeTitle(): void {
      const titleElement = document.querySelector('title')
      const target = titleElement ?? document.documentElement
      if (target) {
        observer.observe(target, {
          childList: true,
          characterData: true,
          subtree: true,
        })
      }
    }

    chrome.runtime.onMessage.addListener(
      (request: ContentRequest, _sender, sendResponse: (response: RuntimeResponse) => void) => {
        if (request.type === 'CONTENT_PING') {
          sendResponse({ ok: true })
        } else if (request.type === 'CONTENT_APPLY_TITLE') {
          applyTitle(request.title)
          sendResponse({ ok: true })
        } else if (request.type === 'CONTENT_CLEAR_TITLE') {
          clearTitle()
          sendResponse({ ok: true })
        }
      },
    )
    document.addEventListener('keydown', handleWindowSwitcherShortcut, true)

    const readyRequest: RuntimeRequest = { type: 'TITLE_CONTENT_READY' }
    void chrome.runtime
      .sendMessage(readyRequest)
      .then((response: RuntimeResponse<TabTitleOverride | undefined>) => {
        if (response.ok && response.data?.title) {
          applyTitle(response.data.title)
        }
      })
      .catch(() => undefined)

    if (document.documentElement) {
      observeTitle()
    } else {
      document.addEventListener('readystatechange', observeTitle, { once: true })
    }
  },
})
