import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { BarChart3, Calendar, Users, Settings, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: '/owner/dashboard', label: 'Statistiche', Icon: BarChart3 },
  { to: '/owner/calendar', label: 'Calendario', Icon: Calendar },
  { to: '/owner/barbers', label: 'Barbieri', Icon: Users },
  { to: '/owner/settings', label: 'Impostazioni', Icon: Settings },
]

export default function OwnerLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 md:pb-0">
      {/* Desktop top nav */}
      <nav className="hidden md:flex bg-white border-b border-slate-200 px-4 py-3 items-center justify-between" aria-label="Navigazione principale">
        <span className="text-blue-600 font-bold text-lg">Barbit</span>
        <div className="flex gap-1 text-sm">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) =>
              `min-h-[44px] flex items-center px-3 rounded-md transition-colors duration-150 ${isActive ? 'text-blue-600 bg-blue-50 font-medium' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`
            }>{item.label}</NavLink>
          ))}
          <button
            onClick={() => { logout(); navigate('/auth/login') }}
            className="min-h-[44px] flex items-center gap-1 px-3 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors duration-150"
            aria-label="Esci dall'account"
          ><LogOut className="w-4 h-4" />Esci</button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <span className="text-blue-600 font-bold text-lg">Barbit</span>
        <button
          onClick={() => { logout(); navigate('/auth/login') }}
          className="min-h-[44px] flex items-center gap-1 px-3 rounded-md text-slate-500 hover:text-slate-900 text-sm"
          aria-label="Esci dall'account"
        ><LogOut className="w-4 h-4" /></button>
      </div>

      <main className="p-4 max-w-4xl mx-auto"><Outlet /></main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around safe-bottom z-50" aria-label="Navigazione principale">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[56px] flex-1 ${isActive ? 'text-blue-600' : 'text-slate-400'}`
          }>
            <item.Icon className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
