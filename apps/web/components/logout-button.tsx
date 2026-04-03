'use client'

import { copy } from '@/lib/copy'
import { logout } from '@/app/actions/auth'

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="px-4 py-2 rounded-lg hover:bg-surface-muted text-text-secondary text-sm font-medium transition-colors"
      >
        {copy.nav.logout}
      </button>
    </form>
  )
}
