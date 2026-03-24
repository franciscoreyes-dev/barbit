import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiScheduleDay, ApiException } from '@/types'

export function useSchedule(barberId: string) {
  return useQuery({
    queryKey: ['barbers', barberId, 'schedule'],
    queryFn: () => api.get<ApiScheduleDay[]>(`/barbers/${barberId}/schedule`).then(r => r.data),
    enabled: !!barberId,
  })
}

export function useUpsertSchedule(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (days: ApiScheduleDay[]) =>
      api.put(`/barbers/${barberId}/schedule`, { days }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'schedule'] }),
  })
}

export function useExceptions(barberId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['barbers', barberId, 'exceptions', { from, to }],
    queryFn: () =>
      api.get<ApiException[]>(`/barbers/${barberId}/exceptions`, { params: { from, to } })
        .then(r => r.data),
    enabled: !!barberId && !!from && !!to,
  })
}

export function useAddException(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ApiException, 'id'>) =>
      api.post(`/barbers/${barberId}/exceptions`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'exceptions'] }),
  })
}

export function useDeleteException(barberId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) =>
      api.delete(`/barbers/${barberId}/exceptions/${date}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barbers', barberId, 'exceptions'] }),
  })
}
