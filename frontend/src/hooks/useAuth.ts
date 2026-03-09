import { useState } from 'react'
import { getStoredUser, logout as logoutUtil } from '@/lib/auth'
import type { User } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  function login(token: string) {
    localStorage.setItem('barbit_token', token)
    setUser(getStoredUser())
  }

  function logout() {
    logoutUtil()
    setUser(null)
  }

  return {
    user,
    isOwner: user?.role === 'owner',
    isBarber: user?.role === 'barber',
    login,
    logout,
  }
}
