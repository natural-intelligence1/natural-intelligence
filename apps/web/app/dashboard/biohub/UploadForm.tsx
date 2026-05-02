'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadLabReport } from './actions'

export default function UploadForm({ memberId }: { memberId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) { setError('Please select a PDF file.'); return }
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return }

    const formData = new FormData()
    formData.set('file', file)
    formData.set('memberId', memberId)

    setError(null)
    startTransition(async () => {
      try {
        const { reportId } = await uploadLabReport(formData)
        router.push(`/dashboard/biohub/${reportId}`)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border-default rounded-xl p-8 text-center cursor-pointer hover:border-brand-default hover:bg-surface-muted transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-sm text-text-secondary">
          {fileName
            ? <span className="font-medium text-text-primary">{fileName}</span>
            : <><span className="text-text-brand font-medium">Click to upload</span> or drag your PDF here</>
          }
        </p>
        <p className="text-xs text-text-muted mt-1">PDF only · max 10 MB</p>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || !fileName}
        className="w-full py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-inverted text-sm font-medium transition-colors"
      >
        {isPending ? 'Uploading…' : 'Upload & analyse'}
      </button>
    </form>
  )
}
