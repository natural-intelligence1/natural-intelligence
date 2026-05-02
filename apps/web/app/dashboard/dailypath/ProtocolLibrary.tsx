'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startProtocol } from './actions'

interface Template {
  id: string
  name: string
  description: string | null
  duration_weeks: number
  root_cause_key: string | null
  root_causes: { name: string; colour: string | null } | null
}

interface ProtocolLibraryProps {
  templates:          Template[]
  suggested:          Template | null
  rootCauseName:      string | null
  highlightTemplateId: string | null
}

export function ProtocolLibrary({
  templates,
  suggested,
  rootCauseName,
  highlightTemplateId,
}: ProtocolLibraryProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStart(templateId: string) {
    startTransition(async () => {
      await startProtocol(templateId)
      router.refresh()
    })
  }

  const highlightId = highlightTemplateId ?? suggested?.id ?? null

  return (
    <div>
      {/* RootFinder suggestion card */}
      {suggested && rootCauseName && (
        <div className="bg-[#F8F1E4] border border-[#B8935A]/30 rounded-xl p-5 mb-8">
          <p className="text-[10px] font-medium text-text-brand uppercase tracking-widest mb-1">
            Based on your RootFinder analysis
          </p>
          <p className="text-base font-medium text-text-primary mb-0.5">{rootCauseName}</p>
          <p className="text-sm text-text-secondary mb-4">
            We suggest the {suggested.name}
          </p>
          <button
            type="button"
            onClick={() => handleStart(suggested.id)}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Starting…' : 'Start this protocol'}
          </button>
        </div>
      )}

      {/* Protocol library grid */}
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
        All protocols
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {templates.map((t) => {
          const isHighlighted = t.id === highlightId
          const colour = t.root_causes?.colour ?? '#B8935A'

          return (
            <div
              key={t.id}
              id={`template-${t.id}`}
              className={`rounded-xl border p-5 flex flex-col transition-colors ${
                isHighlighted
                  ? 'border-[#B8935A] bg-[#F8F1E4]'
                  : 'border-border-default bg-surface-raised'
              }`}
            >
              {/* Root cause badge */}
              {t.root_causes && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colour }}
                  />
                  <span className="text-xs text-text-muted">{t.root_causes.name}</span>
                </div>
              )}

              <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug">
                {t.name}
              </h3>

              {t.description && (
                <p className="text-sm text-text-secondary line-clamp-2 mb-3 leading-relaxed flex-1">
                  {t.description}
                </p>
              )}

              <p className="text-xs text-text-muted mb-4">
                {t.duration_weeks}-week protocol
              </p>

              <button
                type="button"
                onClick={() => handleStart(t.id)}
                disabled={isPending}
                className="w-full px-4 py-2 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors disabled:opacity-50 mt-auto"
              >
                {isPending ? 'Starting…' : 'Start protocol'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
