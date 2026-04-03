import { createServerSupabaseClient } from '@natural-intelligence/db'
import { adminLogout } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function AdminDashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Server-side role check — non-admins are blocked here regardless of session
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm">Your account does not have admin privileges.</p>
          <form action={adminLogout} className="mt-6">
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-300">
              Sign out
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-white">NI Admin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{profile.full_name || user.email}</span>
          <form action={adminLogout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-300">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Signed in as <span className="text-green-400">{user.email}</span></p>
      </div>
    </main>
  )
}
