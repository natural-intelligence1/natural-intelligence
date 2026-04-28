'use client'

import { useState } from 'react'
import { copy } from '@/lib/copy'
import {
  seedTestApplication,
  seedTestPractitioner,
  seedTestSupportRequest,
  resetTestData,
} from './actions'

type Result = { type: 'success' | 'error'; msg: string } | null

function SeedButton({
  label,
  onClick,
  variant = 'default',
  disabled,
}: {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        variant === 'danger'
          ? 'bg-status-errorBg text-status-errorText border border-status-errorBorder hover:bg-status-errorBorder'
          : 'bg-brand-default hover:bg-brand-hover text-text-inverted'
      }`}
    >
      {label}
    </button>
  )
}

export default function SeedClient() {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<Result>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const c = copy.dev.seed

  async function run<T>(fn: () => Promise<T>, successMsg: (v: T) => string) {
    setLoading(true)
    setResult(null)
    try {
      const v = await fn()
      setResult({ type: 'success', msg: successMsg(v) })
    } catch (err: any) {
      setResult({ type: 'error', msg: err?.message ?? c.error })
    } finally {
      setLoading(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="space-y-6">

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          result.type === 'success'
            ? 'bg-status-successBg text-status-successText border border-status-successBorder'
            : 'bg-status-errorBg text-status-errorText border border-status-errorBorder'
        }`}>
          {result.msg}
        </div>
      )}

      {/* Create test data */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary mb-1">{c.heading}</h2>
        <p className="text-sm text-text-muted mb-4">
          Each action creates one row (and a linked test auth user where needed) marked <code className="bg-surface-muted px-1 rounded text-xs">is_test_data=true</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          <SeedButton
            label={c.createApplication}
            disabled={loading}
            onClick={() =>
              run(
                () => seedTestApplication(),
                (v) => `${c.success} Application created — ID: ${v.id}`,
              )
            }
          />
          <SeedButton
            label={c.createPractitioner}
            disabled={loading}
            onClick={() =>
              run(
                () => seedTestPractitioner(),
                (v) => `${c.success} Practitioner created — ID: ${v.id}`,
              )
            }
          />
          <SeedButton
            label={c.createSupportRequest}
            disabled={loading}
            onClick={() =>
              run(
                () => seedTestSupportRequest(),
                (v) => `${c.success} Support request created — ID: ${v.id}`,
              )
            }
          />
        </div>
      </section>

      {/* Reset */}
      <section className="rounded-xl border border-status-errorBorder bg-status-errorBg p-6">
        <h2 className="text-base font-semibold text-status-errorText mb-1">Danger zone</h2>
        <p className="text-sm text-status-errorText opacity-80 mb-4">
          {c.confirmReset}
        </p>
        {!confirmReset ? (
          <SeedButton
            label={c.reset}
            variant="danger"
            disabled={loading}
            onClick={() => setConfirmReset(true)}
          />
        ) : (
          <div className="flex gap-3 items-center">
            <SeedButton
              label="Yes, delete all test data"
              variant="danger"
              disabled={loading}
              onClick={() =>
                run(
                  () => resetTestData(),
                  (v) =>
                    `${c.success} Deleted — ${v.deleted.applications} applications, ` +
                    `${v.deleted.practitioners} practitioners, ` +
                    `${v.deleted.supportRequests} support requests, ` +
                    `${v.deleted.profiles} profiles/auth users.`,
                )
              }
            />
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-surface-muted text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
