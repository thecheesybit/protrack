import { useState } from 'react'
import { Plus, Check, X, Flag } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTodos } from '@/hooks/useWellness'
import { WidgetFrame } from './WidgetFrame'
import { addTodo, updateTodo, deleteTodo } from '@/services/todoService'
import { cn } from '@/utils/cn'

export function TodosWidget({ widget, variant }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const todos = useTodos()
  const [text, setText] = useState('')

  const active = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    setText('')
    try {
      await addTodo(user.uid, { text: value, modeId: activeModeId })
    } catch (err) {
      console.error('[todo] add failed', err)
    }
  }

  const Row = ({ t }) => (
    <div className="group flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2">
      <button
        onClick={() => updateTodo(user.uid, t.id, { done: !t.done })}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          t.done ? 'border-transparent bg-accent text-white' : 'border-line text-transparent hover:border-accent',
        )}
        aria-label="Toggle done"
      >
        <Check className="h-3 w-3" />
      </button>
      <span className={cn('min-w-0 flex-1 truncate text-sm', t.done && 'text-muted line-through')}>
        {t.text}
      </span>
      <button
        onClick={() => deleteTodo(user.uid, t.id)}
        className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
        aria-label="Delete"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={`${active.length} open`}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a to-do…"
            className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={submit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            aria-label="Add"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {todos.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
              <Flag className="h-6 w-6" />
              <span className="text-xs">Nothing yet — capture a quick task.</span>
            </div>
          )}
          {active.map((t) => (
            <Row key={t.id} t={t} />
          ))}
          {done.length > 0 && (
            <>
              <span className="mt-2 px-1 text-[11px] font-medium text-muted">
                Done ({done.length})
              </span>
              {done.slice(0, variant === 'hero' ? 50 : 3).map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </>
          )}
        </div>
      </div>
    </WidgetFrame>
  )
}
