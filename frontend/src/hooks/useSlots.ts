import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useSlots(barberId: string, date: string, serviceId: string) {
  return useQuery({
    queryKey: ['barbers', barberId, 'slots', { date, serviceId }],
    queryFn: () =>
      api.get<string[]>(`/barbers/${barberId}/slots`, { params: { date, serviceId } }).then(r => r.data),
    enabled: !!barberId && !!date && !!serviceId,
    staleTime: 0,
  })
}
