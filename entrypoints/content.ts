import type {
  ContentRequest,
  RuntimeRequest,
  RuntimeResponse,
  TabTitleOverride,
} from '../src/types'

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

    function promptForTitle(initialValue: string): void {
      const nextTitle = window.prompt(
        '为当前标签页设置一个容易识别的标题：',
        initialValue || customTitle || document.title,
      )
      if (nextTitle === null) {
        return
      }
      const title = nextTitle.trim()
      if (!title) {
        window.alert('标题不能为空；如需恢复原始标题，请在 Tabloom 弹窗中点击“恢复”。')
        return
      }
      const request: RuntimeRequest = { type: 'TITLE_SET', title }
      void chrome.runtime.sendMessage(request)
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
        if (request.type === 'CONTENT_APPLY_TITLE') {
          applyTitle(request.title)
          sendResponse({ ok: true })
        } else if (request.type === 'CONTENT_CLEAR_TITLE') {
          clearTitle()
          sendResponse({ ok: true })
        } else if (request.type === 'CONTENT_PROMPT_TITLE') {
          promptForTitle(request.initialValue)
          sendResponse({ ok: true })
        }
      },
    )

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
