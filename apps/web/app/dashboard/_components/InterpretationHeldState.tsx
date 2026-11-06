// ─── InterpretationHeldState ─────────────────────────────────────────────────
// The honest state for a member whose AI interpretation is held.
//
// WHY THIS EXISTS. With the containment guard in place, the old state would
// have shown "Generating your synopsis…", polled for five minutes, then said
// "We couldn't put this together this time." Every part of that is false:
// nothing is generating, nothing is being attempted, and nothing failed. A
// correct guard that tells the member something untrue is not a correct
// change.
//
// This is a server component on purpose — no polling, no timer, no retry
// control. There is nothing to retry, and offering a button that silently
// does nothing is the same dishonesty in a different shape.
//
// WORDING RULES (Founder, Mission 20): calm, client-safe, non-technical. It
// must not imply diagnosis or clinical interpretation, must not blame the
// member, and must not speculate about when it returns — we do not know. It
// also must not leak the reason: "pending Legal/MHRA review" is internal.

export function InterpretationHeldState({
  subject,
  className,
}: {
  /** What is not being generated, as the member would name it. */
  subject: string
  className?: string
}) {
  return (
    <section
      className={
        className ??
        'rounded-xl border border-border-default bg-surface-raised p-8 text-center'
      }
    >
      <h2 className="text-base font-semibold text-text-primary mb-2">
        Your information has been saved
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-2 max-w-md mx-auto">
        {subject} is not currently being generated.
      </p>
      <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
        Everything you have shared is stored safely and nothing is lost. You can
        carry on using the rest of your account as usual.
      </p>
    </section>
  )
}
