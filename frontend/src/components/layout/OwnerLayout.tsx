import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function OwnerLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <nav className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <span className="text-amber-500 font-bold text-lg">Barbit</span>
        <div className="flex gap-4 text-sm">
          <NavLink to="/owner/dashboard" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Dashboard</NavLink>
          <NavLink to="/owner/barbers" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Barbieri</NavLink>
          <NavLink to="/owner/settings" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Impostazioni</NavLink>
          <button onClick={() => { logout(); navigate('/auth/login') }} className="text-zinc-400 hover:text-zinc-50">Esci</button>
        </div>
      </nav>
      <main className="p-4 max-w-4xl mx-auto"><Outlet /></main>
    </div>
  )
}
