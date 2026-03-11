import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiBarberService, ApiCatalogService } from '@/types'

export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service-catalog'],
    queryFn: () => api.get<ApiCatalogService[]>('/service-catalog').then(r => r.data),
  })
}

export function useBarberServices(barberId: string) {
  return useQuery({
    queryKey: ['barbers', barberId, 'services'],
    queryFn: () => api.get<ApiBarberService[]>(`/barbers/${barberId}/services`).then(r => r.data),
    enabled: !!barberId,
  })
}

export function useAddService(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; duration_minutes: number; price?: number; service_catalog_id?: string }) =>
      api.post(`/barbers/${barberId}/services`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'services'] }),
  })
}

export function useUpdateService(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serviceId, ...data }: { serviceId: string; name?: string; duration_minutes?: number; price?: number }) =>
      api.patch(`/barbers/${barberId}/services/${serviceId}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'services'] }),
  })
}

export function useDeleteService(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: string) =>
      api.delete(`/barbers/${barberId}/services/${serviceId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'services'] }),
  })
}
