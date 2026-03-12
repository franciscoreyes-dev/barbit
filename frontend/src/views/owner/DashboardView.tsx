import { useAuth } from '@/hooks/useAuth'
import { useShopAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type { ApiShopAppointment } from '@/types'

const STATUS_LABEL: Record<ApiShopAppointment['status'], string> = {
  confirmed: 'Confermato', cancelled: 'Annullato', completed: 'Completato', no_show: 'No-show',
}
const STATUS_COLOR: Record<ApiShopAppointment['status'], string> = {
  confirmed: 'text-amber-500', cancelled: 'text-zinc-500 line-through',
  completed: 'text-green-400', no_show: 'text-red-400',
}

function AppointmentRow({ appt }: { appt: ApiShopAppointment }) {
  const update = useUpdateAppointmentStatus()
  return (
    <div className="flex items-start justify-between py-3 border-b border-zinc-800 last:border-0">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-500 font-mono text-sm">{format(new Date(appt.start_time), 'HH:mm')}</span>
          <span className="text-zinc-50 font-medium text-sm">{appt.barber_name}</span>
        </div>
        <p className="text-zinc-300 text-sm">{appt.service_name} · {appt.customer_phone}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs ${STATUS_COLOR[appt.status]}`}>{STATUS_LABEL[appt.status]}</span>
        {appt.status === 'confirmed' && (
          <div className="flex gap-1">
            <button onClick={() => update.mutate({ id: appt.id, status: 'completed' })}
              className="text-xs bg-green-900 text-green-300 rounded px-2 py-0.5 hover:bg-green-800">Fatto</button>
            <button onClick={() => update.mutate({ id: appt.id, status: 'no_show' })}
              className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-0.5">No-show</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardView() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const { data: appointments, isLoading, isError } = useShopAppointments(user?.shopId ?? '', today)
  const active = appointments?.filter(a => a.status !== 'cancelled') ?? []
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-50 mb-1">Dashboard</h1>
      <p className="text-zinc-400 text-sm mb-6">
        {format(new Date(), 'EEEE d MMMM yyyy', { locale: it })} · {active.length} appuntamenti
      </p>
      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <p className="text-red-400 text-sm">Errore nel caricamento.</p>}
      {!isLoading && active.length === 0 && <p className="text-zinc-400 text-sm">Nessun appuntamento oggi.</p>}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4">
        {active.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .map(appt => <AppointmentRow key={appt.id} appt={appt} />)}
      </div>
    </div>
  )
}
