import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiBarber } from '@/types'

export function useShopBarbers(shopId: string) {
  return useQuery({
    queryKey: ['shops', shopId, 'barbers'],
    queryFn: () => api.get<ApiBarber[]>(`/shops/${shopId}/barbers`).then(r => r.data),
    enabled: !!shopId,
  })
}

export function useInviteBarber() {
  return useMutation({
    mutationFn: (data: { email: string }) => api.post('/barbers/invite', data).then(r => r.data),
  })
}

export function useUpdateBarber(shopId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; is_active?: boolean }) =>
      api.patch(`/barbers/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops', shopId, 'barbers'] }),
  })
}

export function useDeleteBarber(shopId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/barbers/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops', shopId, 'barbers'] }),
  })
}
