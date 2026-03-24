import { useMemo } from 'react'
import { useShopAppointments } from '@/hooks/useAppointments'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentCard } from './AppointmentCard'
import { format, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface DayColumnProps {
  shopId: string
  date: Date
  compact?: boolean
  barberIds?: string[]
}

export function DayColumn({ shopId, date, compact, barberIds }: DayColumnProps) {
  const dateStr = toDateStr(date)
  const { data: appointments, isLoading, isError } = useShopAppointments(shopId, dateStr)

  const active = useMemo(() => {
    let list = appointments?.filter(a => a.status !== 'cancelled') ?? []
    if (barberIds && barberIds.length > 0) {
      list = list.filter(a => barberIds.includes(a.barber_id))
    }
    return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [appointments, barberIds])

  const today = isSameDay(date, new Date())
  const isWeekCompact = !compact

  return (
    <div className={`flex-1 min-w-0 ${today ? 'bg-blue-50/50 rounded-lg' : ''}`}>
      <div className={`text-center py-2 mb-2 ${today ? 'border-b-2 border-blue-600' : 'border-b border-slate-200'}`}>
        <p className="text-slate-400 text-xs uppercase">{format(date, compact ? 'EEEE' : 'EEE', { locale: it })}</p>
        <p className={`font-bold ${compact ? 'text-xl' : 'text-lg'} ${today ? 'text-blue-600' : 'text-slate-900'}`}>
          {format(date, compact ? 'd MMMM' : 'd', { locale: it })}
        </p>
      </div>
      <div className={`space-y-1.5 min-h-[120px] md:min-h-[200px] ${isWeekCompact ? 'px-0.5' : 'px-1'}`}>
        {isLoading && <Skeleton className="h-16 w-full" />}
        {isError && <p className="text-red-600 text-[10px] text-center mt-4">Errore</p>}
        {active.length === 0 && !isLoading && !isError && (
          <p className="text-slate-300 text-xs text-center mt-4">Nessun appuntamento</p>
        )}
        {active.map((appt, i) => (
          <div key={appt.id} className="animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
            <AppointmentCard appt={appt} compact={isWeekCompact} />
          </div>
        ))}
      </div>
    </div>
  )
}
