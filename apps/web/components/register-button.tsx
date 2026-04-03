'use client'

import { useState, useTransition } from 'react'
import { copy } from '@/lib/copy'

interface RegisterButtonProps {
  eventId: string
  isLoggedIn: boolean
  isFull: boolean
  isRegistered: boolean
  registerAction: (eventId: string) => Promise<{ error?: string }>
}

export function RegisterButton({ eventId, isLoggedIn, isFull, isRegistered, registerAction }: RegisterButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [consented, setConsented] = useState(false)
  const [done, setDone] = useState(isRegistered)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!isLoggedIn) {
    return (
      <a
        href="/auth/login"
        className="inline-block px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm font-medium hover:bg-surface-muted transition-colors"
      >
        {copy.workshops.card.loginToRegister}
      </a>
    )
  }

  if (isFull) {
    return (
      <span className="inline-block px-4 py-2 rounded-lg bg-surface-muted text-text-muted text-sm font-medium cursor-not-allowed">
        {copy.workshops.card.full}
      </span>
    )
  }

  if (done) {
    return (
      <span className="inline-block px-4 py-2 rounded-lg bg-brand-light text-brand-text text-sm font-medium">
        {copy.workshops.card.registered}
      </span>
    )
  }

  const handleConfirm = () => {
    if (!consented) return
    startTransition(async () => {
      const result = await registerAction(eventId)
      if (result.error) {
        setError(result.error)
      } else {
        setDone(true)
        setShowModal(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
      >
        {copy.workshops.card.register}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-modal p-4">
          <div className="bg-surface-raised rounded-xl border border-border-default shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {copy.workshops.modal.heading}
            </h3>

            {error && (
              <p className="text-sm text-status-errorText bg-status-errorBg border border-status-errorBorder rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
              />
              <span className="text-sm text-text-secondary leading-relaxed">
                {copy.workshops.modal.consent}
              </span>
            </label>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors"
              >
                {copy.workshops.modal.cancel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!consented || isPending}
                className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? '…' : copy.workshops.modal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
