// ─── V2 autosave queue — regression tests for the intake typing bug-fix ──────
// No DB, no React: the queue is the pure mechanism behind "typing is never
// blocked, never lost, never overwritten by a save".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createV2AutosaveQueue, type V2SaveState } from './autosaveQueue'

describe('createV2AutosaveQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces typing into one batched save with the latest value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save, debounceMs: 900 })

    // Simulates typing "abc" — three change events, one save.
    queue.queue('v2.concerns.own_words', 'a')
    vi.advanceTimersByTime(300)
    queue.queue('v2.concerns.own_words', 'ab')
    vi.advanceTimersByTime(300)
    queue.queue('v2.concerns.own_words', 'abc')
    vi.advanceTimersByTime(900)
    await vi.runAllTimersAsync()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ 'v2.concerns.own_words': 'abc' })
    expect(queue.hasPending()).toBe(false)
  })

  it('editing existing text replaces the queued value (edit-after-save works)', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save, debounceMs: 900 })

    queue.queue('v2.about.preferred_name', 'Tess')
    await queue.flush()
    queue.queue('v2.about.preferred_name', 'Tessa')
    await queue.flush()

    expect(save).toHaveBeenNthCalledWith(1, { 'v2.about.preferred_name': 'Tess' })
    expect(save).toHaveBeenNthCalledWith(2, { 'v2.about.preferred_name': 'Tessa' })
  })

  it('clearing an optional field to empty string is saved, not skipped', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save })
    queue.queue('v2.arrival.feeling_words', '')
    await queue.flush()
    expect(save).toHaveBeenCalledWith({ 'v2.arrival.feeling_words': '' })
  })

  it('edits made WHILE a save is in flight are kept and saved next', async () => {
    let resolveFirst: () => void = () => {}
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve }))
      .mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save, debounceMs: 900 })

    queue.queue('v2.concerns.own_words', 'first')
    const firstFlush = queue.flush()
    await Promise.resolve() // let the save actually start (batch on the wire)
    // User keeps typing while the save is on the wire.
    queue.queue('v2.concerns.own_words', 'first plus more typing')
    resolveFirst()
    await firstFlush
    await queue.flush()

    expect(save).toHaveBeenNthCalledWith(1, { 'v2.concerns.own_words': 'first' })
    expect(save).toHaveBeenNthCalledWith(2, { 'v2.concerns.own_words': 'first plus more typing' })
  })

  it('a failed save is requeued and retried — and newer local edits win', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined)
    const states: V2SaveState[] = []
    const queue = createV2AutosaveQueue({ save, onState: (s) => states.push(s) })

    queue.queue('v2.medication.items', [{ name: 'as written' }])
    queue.queue('v2.about.full_name', 'Old Name')
    await queue.flush()
    expect(states).toContain('error')
    expect(queue.hasPending()).toBe(true)

    // The user edits the name again before the retry: the newer value wins.
    queue.queue('v2.about.full_name', 'New Name')
    await queue.flush()

    expect(save).toHaveBeenLastCalledWith({
      'v2.medication.items': [{ name: 'as written' }],
      'v2.about.full_name': 'New Name',
    })
    expect(queue.hasPending()).toBe(false)
  })

  it('repeatable card values (arrays of objects) pass through untouched', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save })
    const cards = [
      { name: 'Item one', dose: '10mg as written', who: 'GP' },
      { name: 'Item two', dose: '', who: '' },
    ]
    queue.queue('v2.supplements.items', cards)
    await queue.flush()
    expect(save).toHaveBeenCalledWith({ 'v2.supplements.items': cards })
  })

  it('flush with nothing pending performs no save and reports no state', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const states: V2SaveState[] = []
    const queue = createV2AutosaveQueue({ save, onState: (s) => states.push(s) })
    await queue.flush()
    expect(save).not.toHaveBeenCalled()
    expect(states).toEqual([])
  })

  it('flushes never interleave: batches save strictly in order', async () => {
    const order: string[] = []
    const save = vi.fn().mockImplementation(async (batch: Record<string, unknown>) => {
      order.push(`start:${Object.values(batch).join(',')}`)
      await Promise.resolve()
      order.push(`end:${Object.values(batch).join(',')}`)
    })
    const queue = createV2AutosaveQueue({ save })

    queue.queue('q', 'one')
    const a = queue.flush()
    await Promise.resolve() // save('one') is now in flight
    queue.queue('q', 'two')
    const b = queue.flush()
    await Promise.all([a, b])

    expect(order).toEqual(['start:one', 'end:one', 'start:two', 'end:two'])
  })

  it('dispose cancels the debounce timer but keeps values for a manual flush', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createV2AutosaveQueue({ save, debounceMs: 900 })
    queue.queue('q', 'typed')
    queue.dispose()
    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()
    expect(queue.hasPending()).toBe(true)
    await queue.flush()
    expect(save).toHaveBeenCalledWith({ q: 'typed' })
  })
})
