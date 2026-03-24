import { useUpdateAppointmentStatus } from '@/hooks/useAppointments'
import { Button } from '@/components/ui/button'
import { BarberAvatar, getBarberColor } from '@/components/ui/barber-avatar'
import { PhoneIcon } from '@/components/icons/PhoneIcon'
import { Check, UserX } from 'lucide-react'
import { format } from 'date-fns'
import type { ApiShopAppointment } from '@/types'

const STATUS_LABEL: Record<ApiShopAppointment['status'], string> = {
  confirmed: 'Confermato',
  cancelled: 'Cancellato',
  completed: 'Completato',
  no_show: 'No-show',
}

export function AppointmentCard({ appt, compact }: { appt: ApiShopAppointment; compact?: boolean }) {
  const update = useUpdateAppointmentStatus()
  const color = getBarberColor(appt.barber_name)
  const customerDisplay = appt.customer_name || appt.customer_phone
  const isCompleted = appt.status === 'completed'
  const isNoShow = appt.status === 'no_show'

  if (compact) {
    return (
      <article
        aria-label={`${appt.service_name} con ${customerDisplay} alle ${format(new Date(appt.start_time), 'HH:mm')}`}
        className={`border-l-[3px] rounded-md bg-white px-2 py-1.5 shadow-sm ${color.border} ${isCompleted || isNoShow ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <time dateTime={new Date(appt.start_time).toISOString()} className="text-blue-600 font-mono text-[11px] font-semibold leading-none">{format(new Date(appt.start_time), 'HH:mm')}</time>
          <span className="text-slate-300 text-[10px]">–</span>
          <time dateTime={new Date(appt.end_time).toISOString()} className="text-slate-400 font-mono text-[10px] leading-none">{format(new Date(appt.end_time), 'HH:mm')}</time>
        </div>
        <p className="text-slate-900 text-[11px] font-medium truncate leading-tight">{customerDisplay}</p>
        <p className="text-slate-400 text-[10px] truncate leading-tight">{appt.service_name}</p>
        {(isCompleted || isNoShow) && (
          <span className={`text-[10px] font-medium ${isCompleted ? 'text-emerald-600' : 'text-red-500'}`}>
            {STATUS_LABEL[appt.status]}
          </span>
        )}
        {appt.status === 'confirmed' && (
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => update.mutate({ id: appt.id, status: 'completed' })}
              disabled={update.isPending}
              aria-label={`Segna completato: ${appt.service_name}`}
              className="flex items-center justify-center w-6 h-6 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors duration-150">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update.mutate({ id: appt.id, status: 'no_show' })}
              disabled={update.isPending}
              aria-label={`Segna no-show: ${appt.service_name}`}
              className="flex items-center justify-center w-6 h-6 rounded bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-150">
              <UserX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <article
      aria-label={`${appt.service_name} con ${customerDisplay} alle ${format(new Date(appt.start_time), 'HH:mm')}`}
      className={`border-l-[3px] rounded-lg bg-white p-3 shadow-sm ${color.border} ${isCompleted || isNoShow ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <BarberAvatar name={appt.barber_name} size="sm" />
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
              {STATUS_LABEL[appt.status]}
            </span>
          )}
        </div>
        <a href={`tel:${appt.customer_phone}`} aria-label={`Chiama ${customerDisplay}`}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150 shrink-0">
          <PhoneIcon />
        </a>
      </div>
      {appt.status === 'confirmed' && (
        <div className="flex gap-2 mt-2.5 ml-9">
          <Button size="sm" variant="outline"
            onClick={() => update.mutate({ id: appt.id, status: 'completed' })}
            disabled={update.isPending}
            aria-label={`Segna completato: ${appt.service_name} alle ${format(new Date(appt.start_time), 'HH:mm')}`}
            className="flex-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <Check className="w-3.5 h-3.5 mr-1" />
            Fatto
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => update.mutate({ id: appt.id, status: 'no_show' })}
            disabled={update.isPending}
            aria-label={`Segna no-show: ${appt.service_name} alle ${format(new Date(appt.start_time), 'HH:mm')}`}
            className="flex-1 text-xs">
            <UserX className="w-3.5 h-3.5 mr-1" />
            No-show
          </Button>
        </div>
      )}
    </article>
  )
}
