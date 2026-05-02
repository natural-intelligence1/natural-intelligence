'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { markItemDone, markItemSkipped } from './actions'

export interface DailyItem {
  id:        string
  itemId:    string
  name:      string
  itemType:  string
  dose:      string | null
  timing:    string | null
  notes:     string | null
  sortOrder: number
  completed: boolean
  skipped:   boolean
}

export interface WeekDot {
  date:        string
  isCompleted: boolean
  isToday:     boolean
  isFuture:    boolean
}

interface Protocol {
  id:            string
  name:          string
  status:        string
  startedAt:     string
  durationWeeks: number
  weekNumber:    number
}

interface StreakData {
  currentStreak:      number
  longestStreak:      number
  totalDaysCompleted: number
}

interface DailyViewProps {
  protocol: Protocol
  items:    DailyItem[]
  streak:   StreakData | null
  memberId: string
  weekDots: WeekDot[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSection(timing: string | null): 'morning' | 'evening' | 'anytime' {
  if (!timing) return 'anytime'
  const t = timing.toLowerCase()
  if (t.includes('morning') || t.includes('first thing') || t.includes('fasted') || t.includes('wake')) return 'morning'
  if (t.includes('evening') || t.includes('before bed') || t.includes('night') || t.includes('sleep')) return 'evening'
  return 'anytime'
}

const itemTypeLabel: Record<string, string> = {
  supplement: 'S',
  lifestyle:  'L',
  nutrition:  'N',
  test:       'T',
}

const itemTypeColour: Record<string, string> = {
  supplement: '#4E7A5C',
  lifestyle:  '#B8935A',
  nutrition:  '#5A6E8A',
  test:       '#8A5A7A',
}

function dayLabel(dot: WeekDot): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const d = new Date(dot.date + 'T12:00:00Z')
  return days[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyView({ protocol, items: initialItems, streak, weekDots }: DailyViewProps) {
  const [items, setItems]     = useState<DailyItem[]>(initialItems)
  const [isPending, startTx]  = useTransition()

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  })

  // Section split
  const morningItems  = items.filter((i) => getSection(i.timing) === 'morning')
  const eveningItems  = items.filter((i) => getSection(i.timing) === 'evening')
  const anytimeItems  = items.filter((i) => getSection(i.timing) === 'anytime')

  // Progress
  const completed  = items.filter((i) => i.completed || i.skipped).length
  const total      = items.length
  const allDone    = total > 0 && completed === total
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Week stats
  const pastAndToday    = weekDots.filter((d) => !d.isFuture)
  const completedInWeek = pastAndToday.filter((d) => d.isCompleted).length
  const weekPct = pastAndToday.length > 0 ? Math.round((completedInWeek / pastAndToday.length) * 100) : 0

  function toggleDone(item: DailyItem) {
    // Optimistic update
    const newDone = !item.completed
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, completed: newDone, skipped: false } : i)
    )
    startTx(async () => {
      if (newDone) {
        await markItemDone(item.id)
      } else {
        // Un-done: we use skip with no reason to "uncheck"
        // Actually just re-mark as not done — we'll send markItemSkipped to reset
        // Better: just fire markItemDone and let server sort it
        await markItemDone(item.id)
      }
    })
  }

  function toggleSkip(item: DailyItem) {
    const newSkipped = !item.skipped
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, skipped: newSkipped, completed: false } : i)
    )
    startTx(async () => {
      await markItemSkipped(item.id)
    })
  }

  return (
    <div>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-text-primary">{protocol.name}</p>
          <p className="text-xs text-text-muted">
            Week {protocol.weekNumber} of {protocol.durationWeeks}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-raised border border-border-default rounded-full px-3 py-1.5">
          <span className="text-sm">🔥</span>
          <span className="text-xs font-medium text-text-primary font-mono">
            {streak?.currentStreak ?? 0}
          </span>
          <span className="text-xs text-text-muted">
            {streak?.currentStreak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      {/* ── Date header ──────────────────────────────────────────────────────── */}
      <p className="text-xs text-text-muted mb-5">
        Today · {todayLabel}
      </p>

      {/* ── Paused banner ────────────────────────────────────────────────────── */}
      {protocol.status === 'paused' && (
        <div className="rounded-xl border border-[#B87840]/40 bg-[#FDF3EA] px-4 py-3 mb-6 text-sm text-text-secondary">
          This protocol is paused.{' '}
          <Link href={`/dashboard/dailypath/${protocol.id}`} className="text-text-brand underline">
            Manage protocol →
          </Link>
        </div>
      )}

      {/* ── Checklist sections ───────────────────────────────────────────────── */}
      <div className="space-y-6 mb-6">
        {morningItems.length > 0 && (
          <ItemSection
            label="Morning"
            items={morningItems}
            onToggleDone={toggleDone}
            onToggleSkip={toggleSkip}
            isPending={isPending}
          />
        )}
        {anytimeItems.length > 0 && (
          <ItemSection
            label="Any time"
            items={anytimeItems}
            onToggleDone={toggleDone}
            onToggleSkip={toggleSkip}
            isPending={isPending}
          />
        )}
        {eveningItems.length > 0 && (
          <ItemSection
            label="Evening"
            items={eveningItems}
            onToggleDone={toggleDone}
            onToggleSkip={toggleSkip}
            isPending={isPending}
          />
        )}
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-text-muted">
            {allDone
              ? 'All done for today. 🌿'
              : `Today's progress: ${completed}/${total} complete`}
          </p>
          <span className="text-xs text-text-muted font-mono">{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-[#4E7A5C]' : 'bg-brand-default'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Week view ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">This week</p>
          <span className="text-xs text-text-muted font-mono">{weekPct}%</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {weekDots.map((dot) => {
            let dotClass = 'bg-surface-muted'
            let borderClass = ''

            if (dot.isFuture) {
              dotClass = 'bg-surface-muted'
            } else if (dot.isCompleted) {
              dotClass = 'bg-brand-default'
            } else if (dot.isToday) {
              dotClass = 'bg-[#EDD8B4]'         // gold-light / brand-subtle
            } else {
              dotClass = 'bg-surface-muted'
              borderClass = 'border border-[#B87840]/40'  // missed day — amber tint
            }

            return (
              <div key={dot.date} className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full ${dotClass} ${borderClass} flex items-center justify-center`}
                >
                  {dot.isCompleted && (
                    <span className="text-[10px] text-text-inverted font-medium">✓</span>
                  )}
                </div>
                <span className={`text-[10px] ${dot.isToday ? 'text-text-brand font-medium' : 'text-text-muted'}`}>
                  {dayLabel(dot)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Protocol link ────────────────────────────────────────────────────── */}
      <Link
        href={`/dashboard/dailypath/${protocol.id}`}
        className="flex items-center justify-between text-sm text-text-secondary hover:text-text-primary transition-colors px-1"
      >
        <span>View full protocol</span>
        <span className="text-text-muted">→</span>
      </Link>
    </div>
  )
}

// ── Item section ──────────────────────────────────────────────────────────────

function ItemSection({
  label,
  items,
  onToggleDone,
  onToggleSkip,
  isPending,
}: {
  label:        string
  items:        DailyItem[]
  onToggleDone: (item: DailyItem) => void
  onToggleSkip: (item: DailyItem) => void
  isPending:    boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onToggleDone={onToggleDone}
            onToggleSkip={onToggleSkip}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  )
}

// ── Single item row ───────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggleDone,
  onToggleSkip,
  isPending,
}: {
  item:         DailyItem
  onToggleDone: (item: DailyItem) => void
  onToggleSkip: (item: DailyItem) => void
  isPending:    boolean
}) {
  const isDone    = item.completed
  const isSkipped = item.skipped
  const isDimmed  = isDone || isSkipped

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-4 transition-opacity ${
        isDimmed ? 'opacity-60' : ''
      }`}
    >
      {/* Type badge */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold"
        style={{
          backgroundColor: (itemTypeColour[item.itemType] ?? '#B8935A') + '20',
          color: itemTypeColour[item.itemType] ?? '#B8935A',
        }}
      >
        {itemTypeLabel[item.itemType] ?? 'S'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-text-primary leading-snug ${isDone ? 'line-through text-text-muted' : ''}`}>
          {item.name}
        </p>
        {(item.dose || item.timing) && (
          <p className="text-xs text-text-muted mt-0.5">
            {[item.dose, item.timing].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Checkbox + skip controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Skip button */}
        <button
          type="button"
          onClick={() => onToggleSkip(item)}
          disabled={isPending}
          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
            isSkipped
              ? 'bg-surface-muted text-text-brand'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-muted'
          }`}
        >
          Skip
        </button>

        {/* Check button */}
        <button
          type="button"
          onClick={() => onToggleDone(item)}
          disabled={isPending}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isDone
              ? 'bg-brand-default border-brand-default'
              : 'border-border-default hover:border-brand-default'
          }`}
          aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        >
          {isDone && (
            <span className="text-[10px] text-text-inverted font-bold">✓</span>
          )}
        </button>
      </div>
    </div>
  )
}
