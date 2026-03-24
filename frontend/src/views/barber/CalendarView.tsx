import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { useBarberAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneIcon } from '@/components/icons/PhoneIcon'
import { Check, UserX } from 'lucide-react'
import { format } from 'date-fns'

export default function CalendarView() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const { data: barbers } = useShopBarbers(user?.shopId ?? '')
  const myBarber = barbers?.find(b => b.user_id === user?.userId)
  const { data: appointments, isLoading, isError } = useBarberAppointments(myBarber?.id ?? '', date)
  const update = useUpdateAppointmentStatus()

  const active = appointments?.filter(a => a.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Il mio calendario</h1>
      <div className="mb-6">
        <label htmlFor="cal-date" className="sr-only">Seleziona data</label>
        <Input id="cal-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
      </div>
      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento degli appuntamenti.</p>}
      {!isLoading && active.length === 0 && !isError && (
        <p className="text-slate-500 text-sm">Nessun appuntamento per questa data.</p>
      )}
      <div className="space-y-2">
        {active.map((appt, i) => {
          const customerDisplay = appt.customer_name || appt.customer_phone
          const isCompleted = appt.status === 'completed'
          const isNoShow = appt.status === 'no_show'
          return (
            <article key={appt.id} aria-label={`${appt.service_name} con ${customerDisplay} alle ${format(new Date(appt.start_time), 'HH:mm')}`}
              className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm animate-fade-in-up ${isCompleted || isNoShow ? 'opacity-60' : ''}`} style={{ '--stagger': i } as React.CSSProperties}>
              <div className="flex items-start gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <time dateTime={new Date(appt.start_time).toISOString()} className="text-blue-600 font-mono text-sm font-semibold">{format(new Date(appt.start_time), 'HH:mm')}</time>
                    <span className="text-slate-400 text-xs">–</span>
                    <time dateTime={new Date(appt.end_time).toISOString()} className="text-slate-400 font-mono text-xs">{format(new Date(appt.end_time), 'HH:mm')}</time>
                  </div>
                  <p className="text-slate-900 text-sm font-medium truncate">{customerDisplay}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-slate-500 text-xs truncate">{appt.service_name}</span>
                    {appt.price && <span className="text-blue-600 text-xs font-medium">€{appt.price}</span>}
                  </div>
                  {(isCompleted || isNoShow) && (
                    <span className={`inline-block mt-1 text-xs font-medium ${isCompleted ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isCompleted ? 'Completato' : 'No-show'}
                    </span>
                  )}
                </div>
                <a href={`tel:${appt.customer_phone}`} aria-label={`Chiama ${customerDisplay}`}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150 shrink-0">
                  <PhoneIcon />
                </a>
              </div>
              {appt.status === 'confirmed' && (
                <div className="flex gap-2 mt-2.5">
                  <Button size="sm" variant="outline"
                    onClick={() => update.mutate({ id: appt.id, status: 'completed' })}
                    disabled={update.isPending} aria-label={`Segna completato: ${appt.service_name}`}
                    className="flex-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                    <Check className="w-3.5 h-3.5 mr-1" />Fatto
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => update.mutate({ id: appt.id, status: 'no_show' })}
                    disabled={update.isPending} aria-label={`Segna no-show: ${appt.service_name}`}
                    className="flex-1 text-xs">
                    <UserX className="w-3.5 h-3.5 mr-1" />No-show
                  </Button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
