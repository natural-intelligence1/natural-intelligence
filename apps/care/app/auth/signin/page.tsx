'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/cases')
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF9' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 400, marginBottom: '8px' }}>Sign in</h1>
        {error && <p style={{ color: '#C0392B', fontSize: '14px' }}>{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #D4D2CC', borderRadius: '6px', fontSize: '15px' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #D4D2CC', borderRadius: '6px', fontSize: '15px' }} />
        <button type="submit"
          style={{ padding: '10px', background: '#1A1917', color: '#F8F6F2', border: 'none', borderRadius: '6px', fontSize: '15px', cursor: 'pointer' }}>
          Continue →
        </button>
      </form>
    </main>
  )
}
