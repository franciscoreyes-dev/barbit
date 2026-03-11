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

// --- API response types (snake_case from backend) ---

export interface ApiShop {
  id: string
  name: string
  slug: string
  address?: string
  city?: string
  phone?: string
  email?: string
  timezone: string
}

export interface ApiBarberService {
  id: string
  barber_id: string
  name: string
  duration_minutes: number
  price?: string | null
  is_active: boolean
}

export interface ApiBarber {
  id: string
  user_id: string        // needed: barber views find own record via user_id === user.userId
  name: string
  avatar_url?: string
  is_active: boolean
  services: ApiBarberService[]
}

export interface ApiScheduleDay {
  day_of_week: number    // 0=Sun … 6=Sat (UTC)
  start_time: string     // 'HH:MM'
  end_time: string
  is_working: boolean
}

export interface ApiException {
  id?: string
  date: string           // 'YYYY-MM-DD'
  is_off: boolean
  start_time?: string | null
  end_time?: string | null
  reason?: string | null
}

export interface ApiCatalogService {
  id: string
  name: string
  default_duration_minutes: number
  category: string
}

export interface ApiAppointment {
  id: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  barber_name: string
  service_name: string
  price?: string | null
  shop_name: string
  notes?: string | null
}

export interface ApiBarberAppointment {
  id: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes?: string | null
  customer_name?: string | null
  customer_phone: string
  service_name: string
  duration_minutes: number
  price?: string | null
}

export interface ApiShopAppointment extends ApiBarberAppointment {
  barber_name: string
}
