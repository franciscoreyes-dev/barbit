import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopStats } from '@/hooks/useShops'
import { useShopBarbers } from '@/hooks/useBarbers'
import { Skeleton } from '@/components/ui/skeleton'
import { BarberAvatar } from '@/components/ui/barber-avatar'
import { BarberFilterStrip } from '@/components/owner/BarberFilterStrip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, subDays } from 'date-fns'
import { it } from 'date-fns/locale'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type ViewMode = 'week' | 'day'

export default function StatsView() {
  const { user } = useAuth()
  const shopId = user?.shopId ?? ''

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [adjustNoShow, setAdjustNoShow] = useState(false)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  const fromStr = viewMode === 'week' ? toDateStr(weekStart) : toDateStr(selectedDay)
  const toStr = viewMode === 'week' ? toDateStr(weekEnd) : toDateStr(selectedDay)

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

  const goToday = useCallback(() => {
    if (viewMode === 'week') {
      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
    } else {
      setSelectedDay(new Date())
    }
  }, [viewMode])

  const goPrev = useCallback(() => {
    if (viewMode === 'week') {
      setWeekStart(w => subWeeks(w, 1))
    } else {
      setSelectedDay(d => subDays(d, 1))
    }
  }, [viewMode])

  const goNext = useCallback(() => {
    if (viewMode === 'week') {
      setWeekStart(w => addWeeks(w, 1))
    } else {
      setSelectedDay(d => addDays(d, 1))
    }
  }, [viewMode])

  const { data: stats, isLoading, isError } = useShopStats(shopId, fromStr, toStr, selectedBarberIds)

  const estimatedProfit = useMemo(() => {
    if (!stats) return null
    const base = stats.expectedRevenue
    if (!adjustNoShow || stats.noShowRate === 0) return base
    const factor = 1 - stats.noShowRate / 100
    return base * factor
  }, [stats, adjustNoShow])

  const dateLabel = viewMode === 'week'
    ? `${format(weekStart, 'd MMM', { locale: it })} — ${format(weekEnd, 'd MMM yyyy', { locale: it })}`
    : format(selectedDay, 'EEEE d MMMM yyyy', { locale: it })

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Statistiche</h1>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5" role="radiogroup" aria-label="Vista">
          <button onClick={() => setViewMode('week')} role="radio" aria-checked={viewMode === 'week'}
            className={`px-3 py-1.5 rounded-md text-xs font-medium min-h-[36px] transition-colors duration-150 ${
              viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            Settimana
          </button>
          <button onClick={() => setViewMode('day')} role="radio" aria-checked={viewMode === 'day'}
            className={`px-3 py-1.5 rounded-md text-xs font-medium min-h-[36px] transition-colors duration-150 ${
              viewMode === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            Giorno
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <button onClick={goPrev} aria-label={viewMode === 'week' ? 'Settimana precedente' : 'Giorno precedente'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors duration-150"><ChevronLeft className="w-5 h-5" /></button>
        <span className="text-slate-700 text-sm font-medium min-w-[180px] text-center first-letter:uppercase">
          {dateLabel}
        </span>
        <button onClick={goNext} aria-label={viewMode === 'week' ? 'Settimana successiva' : 'Giorno successivo'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors duration-150"><ChevronRight className="w-5 h-5" /></button>
        <button onClick={goToday}
          className="min-h-[44px] px-3 flex items-center text-xs text-blue-600 hover:text-blue-700 rounded-md hover:bg-blue-50 transition-colors duration-150">Oggi</button>
      </div>

      {/* Barber filter */}
      {barbers && <BarberFilterStrip barbers={barbers} selectedIds={selectedBarberIds} onToggle={toggleBarber} onToggleAll={toggleAll} />}

      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento delle statistiche.</p>}

      {stats && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[
              { label: 'Appuntamenti', value: stats.totalConfirmed, color: 'text-blue-600' },
              { label: 'Completati', value: stats.totalCompleted, color: 'text-emerald-600' },
              { label: 'Incasso', value: `€${stats.revenue.toFixed(0)}`, color: 'text-blue-600' },
              { label: 'No-show', value: `${stats.noShowRate}%`, color: stats.noShowRate > 15 ? 'text-red-500' : 'text-slate-900' },
            ].map((kpi, i) => (
              <div key={kpi.label} className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
                <p className="text-slate-400 text-xs mb-1">{kpi.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Estimated profit card */}
          {estimatedProfit !== null && (
            <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-sm font-medium">
                  {viewMode === 'day' ? 'Incasso stimato del giorno' : 'Incasso stimato della settimana'}
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={adjustNoShow} onChange={e => setAdjustNoShow(e.target.checked)}
                    className="accent-blue-600 w-4 h-4" />
                  <span>Includi no-show ({stats.noShowRate}%)</span>
                </label>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl md:text-3xl font-bold text-blue-600">€{estimatedProfit.toFixed(0)}</p>
                {adjustNoShow && stats.noShowRate > 0 && (
                  <span className="text-slate-400 text-sm line-through">€{stats.expectedRevenue.toFixed(0)}</span>
                )}
              </div>
              {adjustNoShow && stats.noShowRate > 0 && (
                <p className="text-slate-400 text-xs mt-1">
                  Ridotto del {stats.noShowRate}% per media no-show
                </p>
              )}
            </div>
          )}

          {/* Appointments per day bar chart — only in week view */}
          {viewMode === 'week' && (() => {
            const perDayMap = new Map(stats.appointmentsPerDay.map(d => [d.date, d.count]))
            const fullWeek = days.map(d => {
              const dateStr = toDateStr(d)
              return { date: dateStr, count: perDayMap.get(dateStr) ?? 0 }
            })
            const maxDayCount = Math.max(...fullWeek.map(d => d.count), 1)

            return (
              <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-slate-500 text-sm mb-3">Appuntamenti per giorno</p>
                <div className="flex items-end gap-1.5 md:gap-2 h-28 md:h-36" role="img"
                  aria-label={`Grafico: ${fullWeek.map(d => `${format(new Date(d.date + 'T12:00:00'), 'EEE', { locale: it })} ${d.count}`).join(', ')}`}>
                  {fullWeek.map((day, i) => {
                    const pct = (day.count / maxDayCount) * 100
                    const date = new Date(day.date + 'T12:00:00')
                    const isToday = toDateStr(new Date()) === day.date
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <span className="text-slate-500 text-[10px] md:text-xs">{day.count}</span>
                        <div className={`w-full rounded-t-sm animate-grow-up ${isToday ? 'bg-blue-600' : 'bg-blue-400'}`}
                          style={{ height: `${Math.max(pct, 4)}%`, '--stagger': i } as React.CSSProperties} />
                        <span className={`text-[10px] ${isToday ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                          {format(date, 'EEE', { locale: it })}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <table className="sr-only">
                  <caption>Appuntamenti per giorno</caption>
                  <thead><tr><th>Giorno</th><th>Appuntamenti</th></tr></thead>
                  <tbody>
                    {fullWeek.map(day => (
                      <tr key={day.date}><td>{format(new Date(day.date + 'T12:00:00'), 'EEEE d MMMM', { locale: it })}</td><td>{day.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* Busiest hours */}
          {stats.busiestHours.length > 0 && (() => {
            const maxHourCount = Math.max(...stats.busiestHours.map(h => h.count), 1)
            return (
              <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-slate-500 text-sm mb-3">Ore più frequentate</p>
                <div className="space-y-1.5">
                  {stats.busiestHours.map((h, i) => (
                    <div key={h.hour} className="flex items-center gap-2 animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
                      <span className="text-slate-500 text-xs font-mono w-10 shrink-0">{String(h.hour).padStart(2, '0')}:00</span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-sm animate-grow-right" style={{ width: `${(h.count / maxHourCount) * 100}%`, '--stagger': i } as React.CSSProperties} />
                      </div>
                      <span className="text-slate-500 text-xs w-6 text-right">{h.count}</span>
                    </div>
                  ))}
                </div>
                <table className="sr-only">
                  <caption>Ore più frequentate</caption>
                  <thead><tr><th>Ora</th><th>Appuntamenti</th></tr></thead>
                  <tbody>
                    {stats.busiestHours.map(h => (
                      <tr key={h.hour}><td>{String(h.hour).padStart(2, '0')}:00</td><td>{h.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* Service breakdown */}
          {stats.serviceBreakdown.length > 0 && (() => {
            const maxSvcCount = Math.max(...stats.serviceBreakdown.map(s => s.count), 1)
            return (
              <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-slate-500 text-sm mb-3">Servizi</p>
                <div className="space-y-2.5">
                  {stats.serviceBreakdown.map((svc, i) => (
                    <div key={svc.name} className="animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-900 text-sm font-medium truncate">{svc.name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-400 text-xs">{svc.count} app.</span>
                          {svc.revenue > 0 && <span className="text-blue-600 text-xs font-medium">€{svc.revenue.toFixed(0)}</span>}
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(svc.count / maxSvcCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <table className="sr-only">
                  <caption>Ripartizione servizi</caption>
                  <thead><tr><th>Servizio</th><th>Appuntamenti</th><th>Incasso</th></tr></thead>
                  <tbody>
                    {stats.serviceBreakdown.map(svc => (
                      <tr key={svc.name}><td>{svc.name}</td><td>{svc.count}</td><td>€{svc.revenue.toFixed(0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* Barber breakdown */}
          {stats.barberBreakdown.length > 0 && (
            <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-slate-500 text-sm mb-3">Barbieri</p>
              <div className="space-y-3">
                {stats.barberBreakdown.map((b, i) => (
                  <div key={b.name} className="flex items-center gap-3 animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
                    <BarberAvatar name={b.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 text-sm font-medium truncate">{b.name}</p>
                      <p className="text-slate-400 text-xs">{b.count} appuntamenti</p>
                    </div>
                    {b.revenue > 0 && <span className="text-blue-600 text-sm font-medium shrink-0">€{b.revenue.toFixed(0)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
              <p className="text-slate-400 text-xs mb-1">Media per barbiere</p>
              <p className="text-lg font-bold text-slate-900">{stats.avgBookingsPerBarber}</p>
              <p className="text-slate-400 text-xs">app/barbiere</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
              <p className="text-slate-400 text-xs mb-1">Cancellati</p>
              <p className="text-lg font-bold text-red-500">{stats.totalCancelled}</p>
              <p className="text-slate-400 text-xs">{viewMode === 'week' ? 'questa settimana' : 'oggi'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
