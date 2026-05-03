'use client'

export default function LifetrackerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
      <p className="text-text-secondary text-sm mb-4">
        Something went wrong loading LifeTracker.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  )
}
