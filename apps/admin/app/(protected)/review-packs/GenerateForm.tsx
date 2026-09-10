'use client'

// Sprint 3 — per-case generate button for the admin review-pack queue.
import { useFormState, useFormStatus } from 'react-dom'
import { generatePackForCase, type GeneratePackState } from './actions'

function SubmitButton({ hasPack }: { hasPack: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-muted text-text-primary border border-border-default hover:bg-surface-raised transition-colors disabled:opacity-50"
    >
      {pending ? 'Generating…' : hasPack ? 'Regenerate (new version)' : 'Generate pack'}
    </button>
  )
}

export function GenerateForm({ caseId, hasPack }: { caseId: string; hasPack: boolean }) {
  const [state, formAction] = useFormState<GeneratePackState | null, FormData>(
    generatePackForCase, null,
  )
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="case_id" value={caseId} />
      <SubmitButton hasPack={hasPack} />
      {state && (
        <span className={`text-xs ${state.ok ? 'text-status-successText' : 'text-status-errorText'}`}>
          {state.message}
        </span>
      )}
    </form>
  )
}
