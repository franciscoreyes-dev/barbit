import type { User } from '@/types'

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((str.length + 2) % 3)
  return atob(padded)
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    return JSON.parse(base64UrlDecode(payload))
  } catch {
    return null
  }
}

export function getStoredUser(): User | null {
  const token = localStorage.getItem('barbit_token')
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload || !('userId' in payload)) return null
  const exp = payload.exp as number
  if (Date.now() / 1000 > exp) {
    localStorage.removeItem('barbit_token')
    return null
  }
  return payload as unknown as User
}

export function logout(): void {
  localStorage.removeItem('barbit_token')
}
