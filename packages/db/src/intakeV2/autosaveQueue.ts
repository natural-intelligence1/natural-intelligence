// ─── packages/db/src/intakeV2/autosaveQueue.ts ────────────────────────────────
// Framework-free debounced autosave queue for the V2 intake client.
//
// Contract (the walkthrough bug-fix rules):
//   • Local edits are NEVER blocked by, or lost to, an in-flight save: the
//     queue only carries values handed to it; it never pushes values back.
//   • Edits made while a save is in flight land in the NEXT batch.
//   • A failed batch rejoins the queue (newer local edits win) and is
//     retried on the next flush — nothing typed is silently dropped.
//   • Flushes run strictly one at a time, in order.
// No interpretation anywhere — this moves answer values, nothing more.

export type V2SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface V2AutosaveQueue {
  /** Record a new value for a question and (re)start the debounce timer. */
  queue: (questionId: string, value: unknown) => void
  /** Save everything pending now (also called by the debounce timer). */
  flush: () => Promise<void>
  /** True while anything is unsaved or a save is in flight. */
  hasPending: () => boolean
  /** Cancel the debounce timer (component unmount). Pending values remain. */
  dispose: () => void
}

export function createV2AutosaveQueue(options: {
  save: (batch: Record<string, unknown>) => Promise<void>
  debounceMs?: number
  onState?: (state: V2SaveState) => void
}): V2AutosaveQueue {
  const debounceMs = options.debounceMs ?? 900
  let pending: Record<string, unknown> = {}
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let chain: Promise<void> = Promise.resolve()

  const emit = (state: V2SaveState) => options.onState?.(state)

  function queue(questionId: string, value: unknown): void {
    pending[questionId] = value
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, debounceMs)
  }

  function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null }
    chain = chain.then(async () => {
      if (Object.keys(pending).length === 0) return
      const batch = pending
      pending = {}
      inFlight = true
      emit('saving')
      try {
        await options.save(batch)
        emit(Object.keys(pending).length > 0 ? 'saving' : 'saved')
      } catch {
        // Requeue the failed batch; anything typed since (already in
        // `pending`) wins over the failed values for the same question.
        pending = { ...batch, ...pending }
        emit('error')
      } finally {
        inFlight = false
      }
    })
    return chain
  }

  return {
    queue,
    flush,
    hasPending: () => inFlight || Object.keys(pending).length > 0,
    dispose: () => { if (timer) { clearTimeout(timer); timer = null } },
  }
}
