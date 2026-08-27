import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  assignColor,
  assignLetter,
  buildDefaultName,
  getAllWindowMeta,
  setWindowMeta,
  type WindowMeta,
} from '../../src/lib/window-names'
import { extractHostname } from '../../src/lib/domain'
import type {
  RuntimeRequest,
  WindowSwitcherNavigationKey,
} from '../../src/types'

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
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const shellRef = useRef<HTMLDivElement>(null)
  const hostWindowIdRef = useRef<number>()
  const readyWindowIdRef = useRef<number>()
  const itemRefs = useRef(new Map<number, HTMLButtonElement>())

  const refresh = useCallback(async () => {
    const [allWindows, allMeta, currentWindow] = await Promise.all([
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
      getAllWindowMeta(),
      chrome.windows.getCurrent(),
    ])
    hostWindowIdRef.current ??= currentWindow.id
    if (
      currentWindow.id !== undefined &&
      readyWindowIdRef.current !== currentWindow.id
    ) {
      readyWindowIdRef.current = currentWindow.id
      const request: RuntimeRequest = {
        type: 'SIDEPANEL_READY',
        windowId: currentWindow.id,
      }
      void chrome.runtime.sendMessage(request)
    }

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
    setSelectedId((currentId) => {
      if (currentId !== null && items.some((item) => item.id === currentId)) {
        return currentId
      }
      return items.find((item) => item.focused)?.id ?? items[0]?.id ?? null
    })
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

  useEffect(() => {
    shellRef.current?.focus({ preventScroll: true })
  }, [windows.length])

  useEffect(() => {
    if (selectedId === null) return
    itemRefs.current.get(selectedId)?.scrollIntoView?.({
      block: 'nearest',
    })
  }, [selectedId])

  useEffect(() => {
    const onMessage = (request: RuntimeRequest) => {
      if (request.type === 'SIDEPANEL_KEY') {
        handleNavigationKey(request.key)
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  })

  async function focusWindow(windowId: number) {
    await chrome.windows.update(windowId, { focused: true })
  }

  async function closeSidePanel(): Promise<void> {
    const hostWindowId = hostWindowIdRef.current
    if (hostWindowId !== undefined) {
      const request: RuntimeRequest = {
        type: 'SIDEPANEL_CLOSED',
        windowId: hostWindowId,
      }
      await chrome.runtime.sendMessage(request)
    }
    if (
      hostWindowId !== undefined &&
      typeof chrome.sidePanel.close === 'function'
    ) {
      await chrome.sidePanel.close({ windowId: hostWindowId })
      return
    }
    window.close()
  }

  async function activateSelectedWindow(windowId: number): Promise<void> {
    await focusWindow(windowId)
    await closeSidePanel()
  }

  function moveSelection(offset: -1 | 1): void {
    if (windows.length === 0) return
    setSelectedId((currentId) => {
      const currentIndex = windows.findIndex((item) => item.id === currentId)
      const baseIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex = (baseIndex + offset + windows.length) % windows.length
      return windows[nextIndex]!.id
    })
  }

  function handleNavigationKey(key: WindowSwitcherNavigationKey): void {
    if (editingId !== null) return
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      moveSelection(key === 'ArrowDown' ? 1 : -1)
    } else if (key === 'Enter' && selectedId !== null) {
      void activateSelectedWindow(selectedId)
    } else if (key === 'Escape') {
      void closeSidePanel()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.target instanceof HTMLInputElement) return
    const navigationKeys: WindowSwitcherNavigationKey[] = [
      'ArrowUp',
      'ArrowDown',
      'Enter',
      'Escape',
    ]
    if (navigationKeys.includes(event.key as WindowSwitcherNavigationKey)) {
      event.preventDefault()
      handleNavigationKey(event.key as WindowSwitcherNavigationKey)
    }
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
    <div
      ref={shellRef}
      className="sp-shell"
      tabIndex={-1}
      aria-label="任务窗口切换器"
      onKeyDown={handleKeyDown}
    >
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
            ref={(element) => {
              if (element) itemRefs.current.set(item.id, element)
              else itemRefs.current.delete(item.id)
            }}
            className={`sp-win${item.focused ? ' active' : ''}${
              selectedId === item.id ? ' selected' : ''
            }`}
            onClick={() => {
              setSelectedId(item.id)
              void focusWindow(item.id)
            }}
            onDoubleClick={() => startEdit(item)}
            title={item.activeTabTitle}
            aria-label={`${item.meta.name}，${item.activeTabHostname}，${
              item.tabCount
            } 个标签${selectedId === item.id ? '，已选择' : ''}`}
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
