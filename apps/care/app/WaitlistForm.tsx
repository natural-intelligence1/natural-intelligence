'use client'

import { useState } from 'react'
import { submitWaitlist } from './actions'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    const result = await submitWaitlist(email)
    setStatus(result.ok ? 'success' : 'error')
  }

  if (status === 'success') {
    return (
      <div className="flex justify-center">
        <p className="text-sm font-medium" style={{ color: '#6B9E78' }}>
          We&apos;ll be in touch.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 w-full mx-auto"
      style={{ maxWidth: '460px', flexWrap: 'wrap' } as React.CSSProperties}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        required
        className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
        style={{
          background: '#1A1A1A',
          border: '1px solid #2A2A2A',
          color: '#FAFAF8',
          fontFamily: 'inherit',
          minWidth: '200px',
          transition: 'border-color 200ms',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#C9A96E' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#2A2A2A' }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-lg px-5 py-3 text-sm font-medium"
        style={{
          background: '#C9A96E',
          color: '#111111',
          border: 0,
          cursor: status === 'loading' ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          opacity: status === 'loading' ? 0.7 : 1,
          transition: 'opacity 200ms',
        }}
      >
        {status === 'loading' ? 'Sending…' : 'Notify me'}
      </button>
      {status === 'error' && (
        <p className="w-full text-xs mt-1" style={{ color: '#C4854A' }}>
          Something went wrong — please try again.
        </p>
      )}
    </form>
  )
}
