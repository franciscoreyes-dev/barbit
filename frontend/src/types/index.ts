export interface User {
  userId: string
  role: 'owner' | 'barber'
  shopId: string
}

export interface Customer {
  customerId: string
  shopId: string
}

export interface Shop {
  id: string
  name: string
  slug: string
  address?: string
  city?: string
  phone?: string
  email?: string
  timezone: string
}

export interface Barber {
  id: string
  userId: string
  shopId: string
  name: string
  avatarUrl?: string
  isActive: boolean
}

export interface BarberService {
  id: string
  barberId: string
  name: string
  durationMinutes: number
  price?: number
  isActive: boolean
}
