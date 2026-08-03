import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { GROUP_COLORS, type GroupColor } from '../types'

interface NewGroupFormProps {
  onCreate: (title: string, color: GroupColor) => void
}

export function NewGroupForm({ onCreate }: NewGroupFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<GroupColor>('blue')

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (!title.trim()) return
    onCreate(title.trim(), color)
    setTitle('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="new-group-trigger" onClick={() => setOpen(true)}>
        <Plus size={18} />
        新建自定义分组
      </button>
    )
  }

  return (
    <form className="new-group-form" onSubmit={submit}>
      <div className="new-group-heading">
        <div>
          <span>NEW GROUP</span>
          <strong>创建一个拖放目标</strong>
        </div>
        <button type="button" aria-label="取消新建分组" onClick={() => setOpen(false)}>
          <X size={16} />
        </button>
      </div>
      <label htmlFor="group-name">分组名称</label>
      <input
        id="group-name"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="例如：本周训练任务"
        maxLength={40}
        autoFocus
      />
      <fieldset>
        <legend>分组颜色</legend>
        <div className="color-options">
          {GROUP_COLORS.map((option) => (
            <label key={option} data-color={option}>
              <input
                type="radio"
                name="group-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span />
              <em>{option}</em>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="create-group-button" disabled={!title.trim()}>
        添加到工作台
      </button>
      <p>拖入第一个标签时才会创建 Chrome 原生分组。</p>
    </form>
  )
}
