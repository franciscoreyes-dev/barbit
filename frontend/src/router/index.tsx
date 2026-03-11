import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { lazy } from 'react'
import { getStoredUser } from '@/lib/auth'
import OwnerLayout from '@/components/layout/OwnerLayout'
import BarberLayout from '@/components/layout/BarberLayout'

const HomeView = lazy(() => import('@/views/public/HomeView'))
const ShopView = lazy(() => import('@/views/public/ShopView'))
const BookingView = lazy(() => import('@/views/public/BookingView'))
const OtpView = lazy(() => import('@/views/public/OtpView'))
const LoginView = lazy(() => import('@/views/auth/LoginView'))
const RegisterView = lazy(() => import('@/views/auth/RegisterView'))
const InviteView = lazy(() => import('@/views/auth/InviteView'))
const DashboardView = lazy(() => import('@/views/owner/DashboardView'))
const BarbersView = lazy(() => import('@/views/owner/BarbersView'))
const BarberDetailView = lazy(() => import('@/views/owner/BarberDetailView'))
const SettingsView = lazy(() => import('@/views/owner/SettingsView'))
const CalendarView = lazy(() => import('@/views/barber/CalendarView'))
const ServicesView = lazy(() => import('@/views/barber/ServicesView'))
const ScheduleView = lazy(() => import('@/views/barber/ScheduleView'))

function RequireOwner() {
  const user = getStoredUser()
  if (!user) return <Navigate to={`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`} replace />
  if (user.role !== 'owner') return <Navigate to="/auth/login" replace />
  return <Outlet />
}

function RequireBarber() {
  const user = getStoredUser()
  if (!user) return <Navigate to={`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`} replace />
  if (user.role !== 'barber') return <Navigate to="/auth/login" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/', element: <HomeView /> },
  { path: '/shop/:slug', element: <ShopView /> },
  { path: '/book/:barberId', element: <BookingView /> },
  { path: '/book/:barberId/confirm', element: <OtpView /> },
  { path: '/auth/login', element: <LoginView /> },
  { path: '/auth/register', element: <RegisterView /> },
  { path: '/invite/:token', element: <InviteView /> },
  {
    path: '/owner',
    element: <RequireOwner />,
    children: [{
      element: <OwnerLayout />,
      children: [
        { path: 'dashboard', element: <DashboardView /> },
        { path: 'barbers', element: <BarbersView /> },
        { path: 'barbers/:id', element: <BarberDetailView /> },
        { path: 'settings', element: <SettingsView /> },
      ],
    }],
  },
  {
    path: '/barber',
    element: <RequireBarber />,
    children: [{
      element: <BarberLayout />,
      children: [
        { path: 'calendar', element: <CalendarView /> },
        { path: 'services', element: <ServicesView /> },
        { path: 'schedule', element: <ScheduleView /> },
      ],
    }],
  },
])
