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

export function useUpdateShop(shopId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Pick<ApiShop, 'name' | 'address' | 'city' | 'phone' | 'email' | 'timezone'>>) =>
      api.patch(`/shops/${shopId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
  })
}
