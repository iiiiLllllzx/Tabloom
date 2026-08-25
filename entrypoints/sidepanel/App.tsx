import { useCallback, useEffect, useState } from 'react'
import {
  assignColor,
  assignLetter,
  buildDefaultName,
  getAllWindowMeta,
  setWindowMeta,
  type WindowMeta,
} from '../../src/lib/window-names'
import { extractHostname } from '../../src/lib/domain'

interface WindowItem {
  id: number
  focused: boolean
  tabCount: number
  activeTabTitle: string
  activeTabHostname: string
  meta: WindowMeta
}

export function SidePanelApp() {
  const [windows, setWindows] = useState<WindowItem[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const refresh = useCallback(async () => {
    const [allWindows, allMeta] = await Promise.all([
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
      getAllWindowMeta(),
    ])

    const sorted = allWindows
      .filter((w): w is chrome.windows.Window & { id: number } => w.id !== undefined)
      .sort((a, b) => a.id! - b.id!)

    const usedLetters = new Set<string>()
    const items: WindowItem[] = sorted.map((win, index) => {
      const existing = allMeta[win.id!]
      const activeTab = win.tabs?.find((t) => t.active)
      const hostname = extractHostname(activeTab?.url)
      const letter = existing?.letter ?? assignLetter(index)
      const color = existing?.color ?? assignColor(index)
      if (existing?.letter) usedLetters.add(existing.letter)

      const meta: WindowMeta = existing ?? {
        name: buildDefaultName(letter),
        letter,
        color,
      }

      return {
        id: win.id!,
        focused: win.focused ?? false,
        tabCount: win.tabs?.length ?? 0,
        activeTabTitle: activeTab?.title ?? '',
        activeTabHostname: hostname ?? '新标签页',
        meta,
      }
    })

    setWindows(items)
  }, [])

  useEffect(() => {
    void refresh()

    const onWindows = () => void refresh()
    const onTabs = () => void refresh()
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'session' && changes.windowMeta) {
        void refresh()
      }
    }

    chrome.windows.onCreated.addListener(onWindows)
    chrome.windows.onRemoved.addListener(onWindows)
    chrome.windows.onFocusChanged.addListener(onWindows)
    chrome.tabs.onCreated.addListener(onTabs)
    chrome.tabs.onRemoved.addListener(onTabs)
    chrome.tabs.onUpdated.addListener(onTabs)
    chrome.storage.onChanged.addListener(onStorage)

    return () => {
      chrome.windows.onCreated.removeListener(onWindows)
      chrome.windows.onRemoved.removeListener(onWindows)
      chrome.windows.onFocusChanged.removeListener(onWindows)
      chrome.tabs.onCreated.removeListener(onTabs)
      chrome.tabs.onRemoved.removeListener(onTabs)
      chrome.tabs.onUpdated.removeListener(onTabs)
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [refresh])

  async function focusWindow(windowId: number) {
    await chrome.windows.update(windowId, { focused: true })
  }

  function startEdit(item: WindowItem) {
    setEditingId(item.id)
    setEditValue(item.meta.name)
  }

  async function commitEdit(windowId: number) {
    const name = editValue.trim()
    if (name) {
      await setWindowMeta(windowId, { name })
    }
    setEditingId(null)
  }

  async function createWindow() {
    await chrome.windows.create({ focused: true })
  }

  return (
    <div className="sp-shell">
      <header className="sp-head">
        <div>
          <strong>任务窗口</strong>
          <small>点击切换 · 双击重命名</small>
        </div>
        <span className="sp-count">{windows.length}</span>
      </header>

      <div className="sp-list">
        {windows.length === 0 && (
          <div className="sp-empty">
            <p>暂无普通窗口</p>
            <button onClick={createWindow}>新建窗口</button>
          </div>
        )}

        {windows.map((item) => (
          <button
            key={item.id}
            className={`sp-win${item.focused ? ' active' : ''}`}
            onClick={() => void focusWindow(item.id)}
            onDoubleClick={() => startEdit(item)}
            title={item.activeTabTitle}
          >
            <span
              className="sp-av"
              style={{ background: item.meta.color }}
            >
              {item.meta.letter}
            </span>
            <span className="sp-meta">
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => void commitEdit(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitEdit(item.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  maxLength={40}
                />
              ) : (
                <>
                  <b>{item.meta.name}</b>
                  <small>{item.activeTabHostname}</small>
                </>
              )}
            </span>
            <span className="sp-tabcount">{item.tabCount}</span>
          </button>
        ))}
      </div>

      <footer className="sp-foot">
        <button className="sp-new" onClick={createWindow}>
          + 新建任务窗口
        </button>
      </footer>
    </div>
  )
}
