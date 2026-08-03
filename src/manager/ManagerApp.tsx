import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { sendRequest } from '../lib/runtime'
import type {
  AutoGroupResult,
  ExtensionSettings,
  GroupColor,
  TabCard,
  WorkspaceSnapshot,
} from '../types'
import { GroupColumn } from './GroupColumn'
import { ManagerToolbar } from './ManagerToolbar'
import { NewGroupForm } from './NewGroupForm'
import type { BoardColumn, PendingGroup } from './types'
import { toBoardColumn } from './types'

type Notice = { tone: 'success' | 'error' | 'info'; text: string }

export function ManagerApp() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>()
  const [settings, setSettings] = useState<ExtensionSettings>()
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState<Notice>({
    tone: 'info',
    text: '拖动标签卡片即可调整分组；固定标签不会被移动。',
  })

  const loadWorkspace = useCallback(async (windowId?: number, showBusy = true) => {
    if (showBusy) setBusy(true)
    try {
      const snapshot = await sendRequest<WorkspaceSnapshot>({
        type: 'WORKSPACE_GET',
        windowId,
      })
      setWorkspace(snapshot)
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      if (showBusy) setBusy(false)
    }
  }, [])

  useEffect(() => {
    void Promise.all([
      loadWorkspace(),
      sendRequest<ExtensionSettings>({ type: 'SETTINGS_GET' }).then(setSettings),
    ]).catch((error: Error) => {
      setNotice({ tone: 'error', text: error.message })
    })
  }, [loadWorkspace])

  useEffect(() => {
    const refresh = () => void loadWorkspace(workspace?.selectedWindowId, false)
    chrome.tabs.onCreated.addListener(refresh)
    chrome.tabs.onRemoved.addListener(refresh)
    chrome.tabs.onMoved.addListener(refresh)
    chrome.tabs.onUpdated.addListener(refresh)
    chrome.tabGroups.onCreated.addListener(refresh)
    chrome.tabGroups.onRemoved.addListener(refresh)
    chrome.tabGroups.onUpdated.addListener(refresh)
    chrome.tabGroups.onMoved.addListener(refresh)
    return () => {
      chrome.tabs.onCreated.removeListener(refresh)
      chrome.tabs.onRemoved.removeListener(refresh)
      chrome.tabs.onMoved.removeListener(refresh)
      chrome.tabs.onUpdated.removeListener(refresh)
      chrome.tabGroups.onCreated.removeListener(refresh)
      chrome.tabGroups.onRemoved.removeListener(refresh)
      chrome.tabGroups.onUpdated.removeListener(refresh)
      chrome.tabGroups.onMoved.removeListener(refresh)
    }
  }, [loadWorkspace, workspace?.selectedWindowId])

  const columns = useMemo<BoardColumn[]>(() => {
    const needle = query.trim().toLowerCase()
    const persisted = (workspace?.columns ?? []).map(toBoardColumn).map((column) => ({
      ...column,
      tabs: needle
        ? column.tabs.filter((tab) =>
            [tab.title, tab.customTitle, tab.hostname]
              .filter(Boolean)
              .some((value) => value!.toLowerCase().includes(needle)),
          )
        : column.tabs,
    }))
    const pending: BoardColumn[] = pendingGroups.map((group) => ({
      ...group,
      windowId: workspace?.selectedWindowId ?? -1,
      collapsed: false,
      tabs: [],
      pending: true,
    }))
    return [...persisted, ...pending]
  }, [pendingGroups, query, workspace])

  const moveTargets = columns.map((column) => ({
    id: column.id,
    title: column.pending ? `${column.title}（待创建）` : column.title,
  }))

  async function runAction(action: () => Promise<void>, successText?: string): Promise<void> {
    setBusy(true)
    try {
      await action()
      await loadWorkspace(workspace?.selectedWindowId, false)
      if (successText) setNotice({ tone: 'success', text: successText })
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function moveTab(tabId: number, targetId: BoardColumn['id']): Promise<void> {
    const pending = pendingGroups.find((group) => group.id === targetId)
    await runAction(async () => {
      if (pending && workspace) {
        await sendRequest({
          type: 'GROUP_CREATE',
          tabId,
          windowId: workspace.selectedWindowId,
          title: pending.title,
          color: pending.color,
        })
        setPendingGroups((groups) => groups.filter((group) => group.id !== pending.id))
      } else if (targetId === 'ungrouped') {
        await sendRequest({ type: 'GROUP_UNGROUP', tabId })
      } else if (typeof targetId === 'number') {
        await sendRequest({ type: 'GROUP_MOVE', tabId, groupId: targetId })
      }
    }, '标签分组已更新')
  }

  async function activateTab(tab: TabCard): Promise<void> {
    await runAction(() =>
      sendRequest({ type: 'TAB_ACTIVATE', tabId: tab.id, windowId: tab.windowId }),
    )
  }

  async function renameTab(tab: TabCard): Promise<void> {
    await runAction(async () => {
      await sendRequest({ type: 'TAB_ACTIVATE', tabId: tab.id, windowId: tab.windowId })
      await new Promise((resolve) => setTimeout(resolve, 80))
      await sendRequest({ type: 'TITLE_PROMPT', tabId: tab.id })
    })
  }

  async function autoGroup(): Promise<void> {
    if (!workspace) return
    setBusy(true)
    try {
      const result = await sendRequest<AutoGroupResult>({
        type: 'GROUP_AUTO',
        windowId: workspace.selectedWindowId,
      })
      await loadWorkspace(workspace.selectedWindowId, false)
      setNotice({
        tone: 'success',
        text: result.groupedTabs
          ? `已整理 ${result.groupedTabs} 个标签，创建 ${result.createdGroups} 个分组。`
          : '当前窗口没有需要整理的未分组标签。',
      })
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function toggleAutoGroup(): Promise<void> {
    if (!settings) return
    const updated = await sendRequest<ExtensionSettings>({
      type: 'SETTINGS_UPDATE',
      settings: { autoGroupEnabled: !settings.autoGroupEnabled },
    })
    setSettings(updated)
  }

  const allTabs = workspace?.columns.flatMap((column) => column.tabs) ?? []

  return (
    <main className="manager-shell">
      <ManagerToolbar
        windows={workspace?.windows ?? []}
        selectedWindowId={workspace?.selectedWindowId}
        query={query}
        settings={settings}
        busy={busy}
        onWindowChange={(windowId) => void loadWorkspace(windowId)}
        onQueryChange={setQuery}
        onAutoGroup={() => void autoGroup()}
        onRefresh={() => void loadWorkspace(workspace?.selectedWindowId)}
        onToggleAutoGroup={() => void toggleAutoGroup()}
      />

      <section className="desk-summary">
        <div>
          <span>VISIBLE TABS</span>
          <strong>{allTabs.length.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>CHROME GROUPS</span>
          <strong>
            {(workspace?.columns.filter((column) => column.id !== 'ungrouped').length ?? 0)
              .toString()
              .padStart(2, '0')}
          </strong>
        </div>
        <p>
          Chrome 原生标签组仅存在于单个窗口内。自动整理保留已有分组，手工拖拽结果优先。
        </p>
      </section>

      <div className="board-scroller" aria-busy={busy}>
        <div className="group-board">
          {columns.map((column) => (
            <GroupColumn
              key={String(column.id)}
              column={column}
              moveTargets={moveTargets}
              onDropTab={(tabId, targetId) => void moveTab(tabId, targetId)}
              onMoveTab={(tabId, targetId) => void moveTab(tabId, targetId)}
              onActivateTab={(tab) => void activateTab(tab)}
              onRenameTab={(tabId) => {
                const tab = allTabs.find((candidate) => candidate.id === tabId)
                if (tab) void renameTab(tab)
              }}
              onCloseTab={(tabId) =>
                void runAction(
                  () => sendRequest({ type: 'TAB_CLOSE', tabId }),
                  '标签已关闭',
                )
              }
              onToggleCollapse={(target) => {
                if (typeof target.id !== 'number') return
                void runAction(() =>
                  sendRequest({
                    type: 'GROUP_UPDATE',
                    groupId: target.id as number,
                    changes: { collapsed: !target.collapsed },
                  }),
                )
              }}
            />
          ))}
          <NewGroupForm
            onCreate={(title: string, color: GroupColor) =>
              setPendingGroups((groups) => [
                ...groups,
                { id: `pending:${crypto.randomUUID()}`, title, color },
              ])
            }
          />
        </div>
      </div>

      <aside className={`manager-notice ${notice.tone}`}>
        {notice.tone === 'success' ? (
          <Check size={16} />
        ) : notice.tone === 'error' ? (
          <AlertCircle size={16} />
        ) : (
          <Info size={16} />
        )}
        {notice.text}
      </aside>
    </main>
  )
}
