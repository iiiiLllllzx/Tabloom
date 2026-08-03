import { fireEvent, render, screen } from '@testing-library/react'
import { NewGroupForm } from '../src/manager/NewGroupForm'

describe('新建分组表单', () => {
  it('创建待接收标签的分组', () => {
    const onCreate = vi.fn()
    render(<NewGroupForm onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: '新建自定义分组' }))
    fireEvent.change(screen.getByLabelText('分组名称'), {
      target: { value: '训练任务' },
    })
    fireEvent.click(screen.getByLabelText('green'))
    fireEvent.click(screen.getByRole('button', { name: '添加到工作台' }))

    expect(onCreate).toHaveBeenCalledWith('训练任务', 'green')
    expect(screen.getByRole('button', { name: '新建自定义分组' })).toBeInTheDocument()
  })

  it('没有名称时禁用创建按钮', () => {
    render(<NewGroupForm onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '新建自定义分组' }))
    expect(screen.getByRole('button', { name: '添加到工作台' })).toBeDisabled()
  })
})
