import { fireEvent, render, screen } from '@testing-library/react'
import { ManagerToolbar } from '../src/manager/ManagerToolbar'

function renderToolbar(options: { canUndo: boolean; canRestore: boolean }) {
  const onUndo = vi.fn()
  const onRestore = vi.fn()
  const onUngroupAll = vi.fn()
  const onThresholdChange = vi.fn()
  render(
    <ManagerToolbar
      windows={[{ id: 1, focused: true, tabCount: 8 }]}
      selectedWindowId={1}
      query=""
      settings={{
        schemaVersion: 3,
        autoGroupEnabled: true,
        minTabsPerGroup: 3,
      }}
      busy={false}
      canUndo={options.canUndo}
      canRestore={options.canRestore}
      onWindowChange={vi.fn()}
      onQueryChange={vi.fn()}
      onAutoGroup={vi.fn()}
      onUngroupAll={onUngroupAll}
      onThresholdChange={onThresholdChange}
      onUndo={onUndo}
      onRestore={onRestore}
      onRefresh={vi.fn()}
      onToggleAutoGroup={vi.fn()}
    />,
  )
  return { onUndo, onRestore, onUngroupAll, onThresholdChange }
}

describe('工作台历史按钮', () => {
  it('没有快照时禁用撤销和恢复', () => {
    renderToolbar({ canUndo: false, canRestore: false })
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '恢复分组' })).toBeDisabled()
  })

  it('存在快照时触发对应操作', () => {
    const { onUndo, onRestore } = renderToolbar({
      canUndo: true,
      canRestore: true,
    })
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    fireEvent.click(screen.getByRole('button', { name: '恢复分组' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onRestore).toHaveBeenCalledOnce()
  })

  it('可以修改阈值和取消全部分组', () => {
    const { onUngroupAll, onThresholdChange } = renderToolbar({
      canUndo: true,
      canRestore: true,
    })
    fireEvent.change(screen.getByLabelText('分组阈值'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: '取消分组' }))
    expect(onThresholdChange).toHaveBeenCalledWith(5)
    expect(onUngroupAll).toHaveBeenCalledOnce()
  })
})
