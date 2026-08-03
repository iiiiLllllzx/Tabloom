import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Keyboard,
  PanelTopOpen,
  RotateCcw,
  Sparkles,
  Tags,
} from 'lucide-react'
import { extractHostname, isRestrictedUrl } from '../lib/domain'
import { sendRequest } from '../lib/runtime'
import type {
  AutoGroupResult,
  ExtensionSettings,
  TabTitleOverride,
} from '../types'

type Notice = { tone: 'success' | 'error'; text: string }

export function PopupApp() {
  const [tab, setTab] = useState<chrome.tabs.Tab>()
  const [title, setTitle] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [settings, setSettings] = useState<ExtensionSettings>()
  const [notice, setNotice] = useState<Notice>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setTab(activeTab)
      const loadedSettings = await sendRequest<ExtensionSettings>({ type: 'SETTINGS_GET' })
      setSettings(loadedSettings)
      if (activeTab?.id !== undefined) {
        const override = await sendRequest<TabTitleOverride | undefined>({
          type: 'TITLE_GET',
          tabId: activeTab.id,
        })
        setCustomTitle(override?.title ?? '')
        setTitle(override?.title ?? '')
      }
    }
    void load().catch((error: Error) => {
      setNotice({ tone: 'error', text: error.message })
    })
  }, [])

  const restricted = isRestrictedUrl(tab?.url)

  async function saveTitle(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (tab?.id === undefined || !title.trim()) return
    setBusy(true)
    try {
      await sendRequest({ type: 'TITLE_SET', tabId: tab.id, title })
      setCustomTitle(title.trim())
      setTitle(title.trim())
      setNotice({ tone: 'success', text: '标题已应用到当前标签页' })
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function clearTitle(): Promise<void> {
    if (tab?.id === undefined) return
    setBusy(true)
    try {
      await sendRequest({ type: 'TITLE_CLEAR', tabId: tab.id })
      setCustomTitle('')
      setTitle('')
      setNotice({ tone: 'success', text: '已恢复网站原始标题' })
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function autoGroup(): Promise<void> {
    if (tab?.windowId === undefined) return
    setBusy(true)
    try {
      const result = await sendRequest<AutoGroupResult>({
        type: 'GROUP_AUTO',
        windowId: tab.windowId,
      })
      setNotice({
        tone: 'success',
        text: result.groupedTabs
          ? `已整理 ${result.groupedTabs} 个标签页`
          : '没有需要整理的未分组标签',
      })
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function toggleAutoGroup(): Promise<void> {
    if (!settings) return
    const next = !settings.autoGroupEnabled
    const updated = await sendRequest<ExtensionSettings>({
      type: 'SETTINGS_UPDATE',
      settings: { autoGroupEnabled: next },
    })
    setSettings(updated)
  }

  async function openManager(): Promise<void> {
    await chrome.tabs.create({ url: chrome.runtime.getURL('/manager.html') })
    window.close()
  }

  return (
    <main className="popup-shell">
      <header className="brand-row">
        <div className="brand-mark" aria-hidden="true"><Tags size={18} /></div>
        <div>
          <strong>Tabloom</strong>
          <span>标签识别与编组</span>
        </div>
        <span className="version">01</span>
      </header>

      <section className="current-tab" aria-label="当前标签页">
        <div className="tab-meta">
          <span className="favicon-frame">
            {tab?.favIconUrl ? <img src={tab.favIconUrl} alt="" /> : <PanelTopOpen size={16} />}
          </span>
          <div>
            <span className="eyebrow">CURRENT TAB</span>
            <strong>{customTitle || tab?.title || '正在读取标签页…'}</strong>
            <code>{extractHostname(tab?.url) ?? '受限页面'}</code>
          </div>
        </div>

        <form onSubmit={(event) => void saveTitle(event)}>
          <label htmlFor="tab-title">自定义标题</label>
          <input
            id="tab-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：训练任务 · A100 基线"
            maxLength={120}
            disabled={restricted || busy}
            autoFocus
          />
          <div className="button-row">
            <button className="primary-button" disabled={restricted || busy || !title.trim()}>
              <Check size={15} /> 保存标题
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!customTitle || busy}
              onClick={() => void clearTitle()}
            >
              <RotateCcw size={14} /> 恢复
            </button>
          </div>
        </form>
        {restricted && (
          <p className="inline-warning">
            <AlertCircle size={14} /> Chrome 内置页不允许扩展修改标题
          </p>
        )}
      </section>

      <section className="organize-card">
        <div>
          <span className="eyebrow">AUTO GROUP</span>
          <strong>按域名整理当前窗口</strong>
          <p>已有分组和固定标签不会被改动。</p>
        </div>
        <button className="square-button" onClick={() => void autoGroup()} disabled={busy}>
          <Sparkles size={18} />
          <span className="sr-only">立即整理</span>
        </button>
      </section>

      <label className="switch-row">
        <span>
          自动整理新标签
          <small>仅处理尚未分组的普通网页</small>
        </span>
        <input
          type="checkbox"
          checked={settings?.autoGroupEnabled ?? false}
          onChange={() => void toggleAutoGroup()}
          disabled={!settings}
        />
      </label>

      {notice && (
        <p className={`notice ${notice.tone}`}>
          {notice.tone === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {notice.text}
        </p>
      )}

      <button className="manager-button" onClick={() => void openManager()}>
        打开标签工作台 <ArrowUpRight size={16} />
      </button>

      <footer>
        <Keyboard size={14} />
        <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>E</kbd> 快速重命名</span>
      </footer>
    </main>
  )
}
