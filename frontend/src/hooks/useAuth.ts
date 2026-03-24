import { useState, useEffect, useCallback } from 'react'
import { getStoredUser, logout as logoutUtil } from '@/lib/auth'
import type { User } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'barbit_token') {
        setUser(getStoredUser())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = useCallback((token: string) => {
    localStorage.setItem('barbit_token', token)
    setUser(getStoredUser())
  }, [])

  const logout = useCallback(() => {
    logoutUtil()
    setUser(null)
  }, [])

  return {
    user,
    isOwner: user?.role === 'owner',
    isBarber: user?.role === 'barber',
    login,
    logout,
  }
}
