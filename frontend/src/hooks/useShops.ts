import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiShop, ApiBarber } from '@/types'

export function useShopSearch(q: string, city: string) {
  return useQuery({
    queryKey: ['shops', 'search', { q, city }],
    queryFn: () =>
      api.get<ApiShop[]>('/shops/search', { params: { q: q || undefined, city: city || undefined } })
        .then(r => r.data),
    enabled: q.length >= 2 || city.length >= 2,
  })
}

export function useShopBySlug(slug: string) {
  return useQuery({
    queryKey: ['shops', slug],
    queryFn: () =>
      api.get<{ shop: ApiShop; barbers: ApiBarber[] }>(`/shops/${slug}`).then(r => r.data),
    enabled: !!slug,
  })
}

export function useMyShop() {
  return useQuery({
    queryKey: ['shops', 'mine'],
    queryFn: () => api.get<ApiShop>('/shops/mine').then(r => r.data),
  })
}

export interface ShopStats {
  totalConfirmed: number
  totalCancelled: number
  totalCompleted: number
  totalNoShow: number
  revenue: number
  expectedRevenue: number
  noShowRate: number
  avgBookingsPerBarber: number
  mostRequestedService: { name: string; count: number } | null
  busiestBarber: { name: string; count: number } | null
  appointmentsPerDay: Array<{ date: string; count: number }>
  busiestHours: Array<{ hour: number; count: number }>
  serviceBreakdown: Array<{ name: string; count: number; revenue: number }>
  barberBreakdown: Array<{ name: string; count: number; revenue: number }>
}

export function useShopStats(shopId: string, from: string, to: string, barberIds?: string[]) {
  return useQuery({
    queryKey: ['shops', shopId, 'stats', { from, to, barberIds }],
    queryFn: () =>
      api.get<ShopStats>(`/shops/${shopId}/stats`, {
        params: { from, to, barberIds: barberIds?.join(',') || undefined },
      }).then(r => r.data),
    enabled: !!shopId && !!from && !!to,
  })
}

export function useUpdateShop(shopId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Pick<ApiShop, 'name' | 'address' | 'city' | 'phone' | 'email' | 'timezone'>>) =>
      api.patch(`/shops/${shopId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops', 'mine'] }),
  })
}
