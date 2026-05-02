'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addGoal, updateGoalStatus, archiveGoal } from './actions'

const CATEGORIES = [
  'energy', 'sleep', 'mood', 'fitness', 'nutrition', 'digestion', 'weight', 'other',
]

export interface Goal {
  id:            string
  title:         string
  description:   string | null
  category:      string | null
  target_value:  number | null
  target_unit:   string | null
  target_date:   string | null
  current_value: number | null
  status:        string
}

interface GoalsListProps {
  goals: Goal[]
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-[#4E7A5C] bg-[#E8F2EB]'
  if (status === 'paused')    return 'text-[#B87840] bg-[#FDF3EA]'
  return 'text-text-secondary bg-surface-muted'
}

export function GoalsList({ goals }: GoalsListProps) {
  const router               = useRouter()
  const [isPending, startTx] = useTransition()
  const [showForm, setShowForm]     = useState(false)
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [category, setCategory]     = useState('')
  const [targetValue, setTargetVal] = useState('')
  const [targetUnit, setTargetUnit] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const active   = goals.filter(g => g.status !== 'archived')
  const archived = goals.filter(g => g.status === 'archived')

  function handleAdd() {
    if (!title.trim()) return
    const fd = new FormData()
    fd.append('title', title.trim())
    if (description.trim()) fd.append('description', description.trim())
    if (category)           fd.append('category', category)
    if (targetValue)        fd.append('target_value', targetValue)
    if (targetUnit.trim())  fd.append('target_unit', targetUnit.trim())
    if (targetDate)         fd.append('target_date', targetDate)

    startTx(async () => {
      await addGoal(fd)
      setTitle(''); setDesc(''); setCategory(''); setTargetVal(''); setTargetUnit(''); setTargetDate('')
      setShowForm(false)
      router.refresh()
    })
  }

  function handleStatus(goalId: string, status: string) {
    startTx(async () => {
      await updateGoalStatus(goalId, status)
      router.refresh()
    })
  }

  function handleArchive(goalId: string) {
    startTx(async () => {
      await archiveGoal(goalId)
      router.refresh()
    })
  }

  return (
    <div>
      {/* Active goals */}
      {active.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted">No active goals yet.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {active.map(goal => (
            <div
              key={goal.id}
              className="rounded-xl border border-border-default bg-surface-raised p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{goal.title}</p>
                  {goal.description && (
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{goal.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {goal.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-muted text-text-muted capitalize">
                        {goal.category}
                      </span>
                    )}
                    {goal.target_value !== null && (
                      <span className="text-[10px] text-text-muted font-mono">
                        Target: {goal.target_value} {goal.target_unit ?? ''}
                      </span>
                    )}
                    {goal.target_date && (
                      <span className="text-[10px] text-text-muted">
                        By {new Date(goal.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusColor(goal.status)}`}>
                      {goal.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {goal.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleStatus(goal.id, 'completed')}
                      disabled={isPending}
                      title="Mark complete"
                      className="w-6 h-6 rounded-full border border-border-default flex items-center justify-center hover:border-[#4E7A5C] hover:bg-[#E8F2EB] transition-colors disabled:opacity-50"
                    >
                      <span className="text-[10px]">✓</span>
                    </button>
                  )}
                  {goal.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleStatus(goal.id, 'active')}
                      disabled={isPending}
                      title="Reopen"
                      className="text-[10px] text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleArchive(goal.id)}
                    disabled={isPending}
                    title="Archive"
                    className="text-[10px] text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add goal form */}
      {showForm ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 mb-3">
          <p className="text-xs font-medium text-text-primary mb-3">New goal</p>
          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Goal title *"
              className="w-full rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
            />
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
              >
                <option value="">Category</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={targetValue}
                onChange={e => setTargetVal(e.target.value)}
                placeholder="Target value"
                className="rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
              />
              <input
                type="text"
                value={targetUnit}
                onChange={e => setTargetUnit(e.target.value)}
                placeholder="Unit (e.g. kg, hrs)"
                className="rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!title.trim() || isPending}
              className="flex-1 px-3 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-40"
            >
              {isPending ? 'Adding…' : 'Add goal'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-text-brand hover:text-text-primary transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add a goal
        </button>
      )}

      {/* Archived goals (collapsed) */}
      {archived.length > 0 && (
        <details className="mt-5 rounded-xl border border-border-default bg-surface-raised overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer text-xs font-medium text-text-muted list-none flex items-center justify-between select-none">
            Archived ({archived.length})
            <span className="text-[10px]">▼</span>
          </summary>
          <div className="px-5 pb-4 border-t border-border-default pt-3 space-y-2">
            {archived.map(goal => (
              <div key={goal.id} className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted line-through">{goal.title}</p>
                <button
                  type="button"
                  onClick={() => handleStatus(goal.id, 'active')}
                  disabled={isPending}
                  className="text-[10px] text-text-brand hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
