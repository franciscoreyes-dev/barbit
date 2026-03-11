import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiAppointment, ApiBarberAppointment, ApiShopAppointment } from '@/types'

export function useMyAppointments(customerToken: string | null) {
  return useQuery({
    queryKey: ['appointments', 'mine', customerToken],
    queryFn: () =>
      api.get<ApiAppointment[]>('/appointments/mine', {
        headers: { Authorization: `Bearer ${customerToken}` },
      }).then(r => r.data),
    enabled: !!customerToken,
  })
}

export function useBarberAppointments(barberId: string, date: string) {
  return useQuery({
    queryKey: ['barbers', barberId, 'appointments', date],
    queryFn: () =>
      api.get<ApiBarberAppointment[]>(`/barbers/${barberId}/appointments`, { params: { date } })
        .then(r => r.data),
    enabled: !!barberId && !!date,
  })
}

export function useShopAppointments(shopId: string, date: string) {
  return useQuery({
    queryKey: ['shops', shopId, 'appointments', date],
    queryFn: () =>
      api.get<ApiShopAppointment[]>(`/shops/${shopId}/appointments`, { params: { date } })
        .then(r => r.data),
    enabled: !!shopId && !!date,
  })
}

export function useCreateAppointment(customerToken: string | null) {
  return useMutation({
    mutationFn: (data: { barberId: string; serviceId: string; startTime: string }) =>
      api.post<{ id: string; start_time: string; end_time: string }>('/appointments', data, {
        headers: { Authorization: `Bearer ${customerToken}` },
      }).then(r => r.data),
  })
}

export function useCancelAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`).then(r => r.data),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['appointments', 'mine'] })
      const prev = qc.getQueryData<ApiAppointment[]>(['appointments', 'mine'])
      qc.setQueryData<ApiAppointment[]>(['appointments', 'mine'], old =>
        old?.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a) ?? []
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['appointments', 'mine'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['appointments', 'mine'] }),
  })
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'no_show' }) =>
      api.patch(`/appointments/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['barbers'] })
      qc.invalidateQueries({ queryKey: ['shops'] })
    },
  })
}
