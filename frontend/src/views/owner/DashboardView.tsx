import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { DayColumn } from '@/components/owner/DayColumn'
import { BarberFilterStrip } from '@/components/owner/BarberFilterStrip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardView() {
  const { user } = useAuth()
  const shopId = user?.shopId ?? ''
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [mobileDay, setMobileDay] = useState(() => {
    const today = new Date()
    const ws = startOfWeek(today, { weekStartsOn: 1 })
    const diff = Math.floor((today.getTime() - ws.getTime()) / 86400000)
    return Math.min(Math.max(diff, 0), 6)
  })

  const { data: barbers } = useShopBarbers(shopId)
  const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>([])

  useEffect(() => {
    if (barbers && barbers.length > 0 && selectedBarberIds.length === 0) {
      setSelectedBarberIds(barbers.map(b => b.id))
    }
  }, [barbers, selectedBarberIds.length])

  const toggleBarber = useCallback((id: string) => {
    setSelectedBarberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }, [])

  const toggleAll = useCallback(() => {
    if (!barbers) return
    const allSelected = selectedBarberIds.length === barbers.length
    setSelectedBarberIds(allSelected ? [] : barbers.map(b => b.id))
  }, [barbers, selectedBarberIds.length])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  const goPrevDay = useCallback(() => {
    if (mobileDay > 0) {
      setMobileDay(d => d - 1)
    } else {
      setWeekStart(w => subWeeks(w, 1))
      setMobileDay(6)
    }
  }, [mobileDay])

  const goNextDay = useCallback(() => {
    if (mobileDay < 6) {
      setMobileDay(d => d + 1)
    } else {
      setWeekStart(w => addWeeks(w, 1))
      setMobileDay(0)
    }
  }, [mobileDay])

  const goToday = useCallback(() => {
    const today = new Date()
    const ws = startOfWeek(today, { weekStartsOn: 1 })
    setWeekStart(ws)
    const diff = Math.floor((today.getTime() - ws.getTime()) / 86400000)
    setMobileDay(Math.min(Math.max(diff, 0), 6))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Calendario</h1>
        <div className="hidden md:flex items-center gap-1">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} aria-label="Settimana precedente"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors duration-150"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-slate-700 text-sm font-medium min-w-[180px] text-center">
            {format(weekStart, 'd MMM', { locale: it })} — {format(weekEnd, 'd MMM yyyy', { locale: it })}
          </span>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} aria-label="Settimana successiva"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors duration-150"><ChevronRight className="w-5 h-5" /></button>
          <button onClick={goToday}
            className="min-h-[44px] px-3 flex items-center text-xs text-blue-600 hover:text-blue-700 rounded-md hover:bg-blue-50 transition-colors duration-150">Oggi</button>
        </div>
      </div>

      {barbers && <BarberFilterStrip barbers={barbers} selectedIds={selectedBarberIds} onToggle={toggleBarber} onToggleAll={toggleAll} />}

      {/* Mobile day navigation */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goPrevDay} aria-label="Giorno precedente"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={goToday}
            className="text-xs text-blue-600 hover:text-blue-700 min-h-[44px] px-3 transition-colors duration-150">Oggi</button>
          <button onClick={goNextDay} aria-label="Giorno successivo"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-1">
          {days.map((day, i) => {
            const isToday = isSameDay(day, new Date())
            const isSelected = i === mobileDay
            return (
              <button key={i} onClick={() => setMobileDay(i)}
                aria-label={format(day, 'EEEE d MMMM', { locale: it })}
                aria-current={isSelected ? 'date' : undefined}
                className={`flex-1 py-1.5 rounded-md text-center min-h-[44px] flex flex-col items-center justify-center transition-colors duration-150 ${
                  isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-600' : 'text-slate-400'
                }`}>
                <span className="text-[10px] uppercase">{format(day, 'EEE', { locale: it })}</span>
                <span className="text-sm font-bold">{format(day, 'd')}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="md:hidden">
        <DayColumn shopId={shopId} date={days[mobileDay]} compact barberIds={selectedBarberIds} />
      </div>
      <div className="hidden md:flex gap-1">
        {days.map(day => (
          <DayColumn key={toDateStr(day)} shopId={shopId} date={day} barberIds={selectedBarberIds} />
        ))}
      </div>
    </div>
  )
}
