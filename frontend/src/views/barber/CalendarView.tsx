import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { useBarberAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

export default function CalendarView() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const { data: barbers } = useShopBarbers(user?.shopId ?? '')
  const myBarber = barbers?.find(b => b.user_id === user?.userId)
  const { data: appointments, isLoading, isError } = useBarberAppointments(myBarber?.id ?? '', date)
  const update = useUpdateAppointmentStatus()

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-50 mb-4">Il mio calendario</h1>
      <div className="mb-6">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 focus:outline-none focus:border-amber-500" />
      </div>
      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <p className="text-red-400 text-sm">Errore nel caricamento.</p>}
      {!isLoading && (appointments?.filter(a => a.status !== 'cancelled').length ?? 0) === 0 && (
        <p className="text-zinc-400 text-sm">Nessun appuntamento per questa data.</p>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {appointments?.filter(a => a.status !== 'cancelled')
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .map(appt => (
            <div key={appt.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500 font-mono text-sm">{format(new Date(appt.start_time), 'HH:mm')}</span>
                  <span className="text-zinc-50 text-sm">{appt.service_name}</span>
                </div>
                <p className="text-zinc-400 text-xs">{appt.customer_phone}</p>
              </div>
              {appt.status === 'confirmed' && (
                <div className="flex gap-1">
                  <button onClick={() => update.mutate({ id: appt.id, status: 'completed' })}
                    className="text-xs bg-green-900 text-green-300 rounded px-2 py-0.5">Fatto</button>
                  <button onClick={() => update.mutate({ id: appt.id, status: 'no_show' })}
                    className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-0.5">No-show</button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
