import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { lazy } from 'react'
import { getStoredUser } from '@/lib/auth'

const HomeView = lazy(() => import('@/views/public/HomeView'))
const LoginView = lazy(() => import('@/views/auth/LoginView'))
const RegisterView = lazy(() => import('@/views/auth/RegisterView'))
const InviteView = lazy(() => import('@/views/auth/InviteView'))

function RequireOwner() {
  const user = getStoredUser()
  if (!user) return <Navigate to="/auth/login" replace />
  if (user.role !== 'owner') return <Navigate to="/auth/login" replace />
  return <Outlet />
}

function RequireBarber() {
  const user = getStoredUser()
  if (!user) return <Navigate to="/auth/login" replace />
  if (user.role !== 'barber') return <Navigate to="/auth/login" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/', element: <HomeView /> },
  { path: '/auth/login', element: <LoginView /> },
  { path: '/auth/register', element: <RegisterView /> },
  { path: '/invite/:token', element: <InviteView /> },
  {
    path: '/owner',
    element: <RequireOwner />,
    children: [
      { path: 'dashboard', element: <div>Owner Dashboard (Phase 2)</div> },
      { path: 'barbers', element: <div>Barbers (Phase 2)</div> },
      { path: 'settings', element: <div>Settings (Phase 2)</div> },
    ],
  },
  {
    path: '/barber',
    element: <RequireBarber />,
    children: [
      { path: 'calendar', element: <div>Calendar (Phase 2)</div> },
      { path: 'services', element: <div>Services (Phase 2)</div> },
      { path: 'schedule', element: <div>Schedule (Phase 2)</div> },
    ],
  },
])
