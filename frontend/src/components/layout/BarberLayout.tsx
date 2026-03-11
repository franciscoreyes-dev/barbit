import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function BarberLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <nav className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <span className="text-amber-500 font-bold text-lg">Barbit</span>
        <div className="flex gap-4 text-sm">
          <NavLink to="/barber/calendar" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Calendario</NavLink>
          <NavLink to="/barber/services" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Servizi</NavLink>
          <NavLink to="/barber/schedule" className={({ isActive }) => isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-50'}>Orari</NavLink>
          <button onClick={() => { logout(); navigate('/auth/login') }} className="text-zinc-400 hover:text-zinc-50">Esci</button>
        </div>
      </nav>
      <main className="p-4 max-w-4xl mx-auto"><Outlet /></main>
    </div>
  )
}
