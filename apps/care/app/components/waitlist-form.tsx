'use client'

import { useState } from 'react'
import { submitWaitlist } from '../actions'

export default function WaitlistForm() {
  const [email,  setEmail]  = useState('')
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
        <p className="text-sm font-medium" style={{ color: '#B8935A' }}>
          You&apos;re on the list.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 justify-center"
      style={{ flexWrap: 'wrap' } as React.CSSProperties}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="rounded-lg px-4 py-3 text-sm outline-none"
        style={{
          background:    '#1A1917',
          border:        '1px solid #2A2825',
          color:         '#F8F6F2',
          fontFamily:    'inherit',
          width:         '320px',
          maxWidth:      '100%',
          transition:    'border-color 200ms',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#B8935A' }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = '#2A2825' }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-lg px-6 py-3 text-sm font-medium"
        style={{
          background:  '#B8935A',
          color:       '#0E0D0B',
          border:      0,
          cursor:      status === 'loading' ? 'wait' : 'pointer',
          fontFamily:  'inherit',
          opacity:     status === 'loading' ? 0.7 : 1,
          transition:  'opacity 200ms',
        }}
      >
        {status === 'loading' ? 'Sending…' : 'Notify me'}
      </button>
      {status === 'error' && (
        <p className="w-full text-center text-xs mt-1" style={{ color: '#B87840' }}>
          Something went wrong — please try again.
        </p>
      )}
    </form>
  )
}
