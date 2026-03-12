import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBarberServices, useAddService, useDeleteService } from '@/hooks/useServices'
import { useSchedule, useUpsertSchedule, useExceptions, useAddException, useDeleteException } from '@/hooks/useAvailability'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ApiScheduleDay, ApiException } from '@/types'

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

const DEFAULT_SCHEDULE: ApiScheduleDay[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i, start_time: '09:00', end_time: '18:00', is_working: i >= 1 && i <= 5,
}))

export default function BarberDetailView() {
  const { id: barberId } = useParams<{ id: string }>()
  const bid = barberId ?? ''

  const { data: services, isLoading: loadingSvc } = useBarberServices(bid)
  const addSvc = useAddService(bid)
  const deleteSvc = useDeleteService(bid)
  const [svcName, setSvcName] = useState('')
  const [svcDur, setSvcDur] = useState('')
  const [svcPrice, setSvcPrice] = useState('')

  const { data: schedule, isLoading: loadingSched } = useSchedule(bid)
  const upsertSched = useUpsertSchedule(bid)
  const [editedSched, setEditedSched] = useState<ApiScheduleDay[]>(DEFAULT_SCHEDULE)
  const [schedSaved, setSchedSaved] = useState(false)
  useEffect(() => { if (schedule) setEditedSched(schedule) }, [schedule])

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const { data: exceptions, isLoading: loadingExc } = useExceptions(bid, today, in30)
  const addExc = useAddException(bid)
  const deleteExc = useDeleteException(bid)
  const [excDate, setExcDate] = useState('')
  const [excOff, setExcOff] = useState(false)
  const [excStart, setExcStart] = useState('')
  const [excEnd, setExcEnd] = useState('')
  const [excReason, setExcReason] = useState('')

  return (
    <div className="space-y-10">
      {/* Services */}
      <section>
        <h2 className="text-xl font-bold text-zinc-50 mb-4">Servizi</h2>
        {loadingSvc && <Skeleton className="h-32 w-full" />}
        <div className="space-y-2 mb-4">
          {services?.filter(s => s.is_active).map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div>
                <p className="text-zinc-50 text-sm font-medium">{s.name}</p>
                <p className="text-zinc-400 text-xs">{s.duration_minutes}min{s.price ? ` · €${s.price}` : ''}</p>
              </div>
              <button onClick={() => deleteSvc.mutate(s.id)}
                className="text-xs text-zinc-500 hover:text-red-400">Disattiva</button>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-zinc-400 text-sm font-medium">Aggiungi servizio</p>
          <Input placeholder="Nome" value={svcName} onChange={e => setSvcName(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Durata (min)" type="number" value={svcDur} onChange={e => setSvcDur(e.target.value)} className="flex-1" />
            <Input placeholder="Prezzo (€)" type="number" step="0.01" value={svcPrice} onChange={e => setSvcPrice(e.target.value)} className="flex-1" />
          </div>
          <Button onClick={async () => {
            await addSvc.mutateAsync({ name: svcName, duration_minutes: Number(svcDur), price: svcPrice ? Number(svcPrice) : undefined })
            setSvcName(''); setSvcDur(''); setSvcPrice('')
          }} disabled={addSvc.isPending || !svcName || !svcDur} className="bg-amber-500 text-zinc-950">
            Aggiungi
          </Button>
        </div>
      </section>

      {/* Weekly schedule */}
      <section>
        <h2 className="text-xl font-bold text-zinc-50 mb-4">Orario settimanale</h2>
        {loadingSched && <Skeleton className="h-48 w-full" />}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 mb-4">
          {editedSched.map((day, i) => (
            <div key={day.day_of_week} className="flex items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={day.is_working}
                onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, is_working: e.target.checked } : d))}
                className="accent-amber-500" />
              <span className="text-zinc-300 text-sm w-24">{DAY_NAMES[day.day_of_week]}</span>
              {day.is_working && (
                <>
                  <Input type="time" value={day.start_time}
                    onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, start_time: e.target.value } : d))}
                    className="w-28 text-sm" />
                  <span className="text-zinc-500 text-sm">—</span>
                  <Input type="time" value={day.end_time}
                    onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, end_time: e.target.value } : d))}
                    className="w-28 text-sm" />
                </>
              )}
            </div>
          ))}
        </div>
        <Button onClick={async () => { await upsertSched.mutateAsync(editedSched); setSchedSaved(true); setTimeout(() => setSchedSaved(false), 3000) }}
          disabled={upsertSched.isPending} className="bg-amber-500 text-zinc-950">
          {upsertSched.isPending ? 'Salvataggio...' : 'Salva orario'}
        </Button>
        {schedSaved && <span className="ml-3 text-green-400 text-sm">Salvato!</span>}
      </section>

      {/* Exceptions */}
      <section>
        <h2 className="text-xl font-bold text-zinc-50 mb-4">Eccezioni (prossimi 30 giorni)</h2>
        {loadingExc && <Skeleton className="h-24 w-full" />}
        <div className="space-y-2 mb-4">
          {exceptions?.map((exc: ApiException) => (
            <div key={exc.date} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div>
                <p className="text-zinc-50 text-sm">{exc.date} · {exc.is_off ? 'Giorno libero' : `${exc.start_time}–${exc.end_time}`}</p>
                {exc.reason && <p className="text-zinc-400 text-xs">{exc.reason}</p>}
              </div>
              <button onClick={() => deleteExc.mutate(exc.date)}
                className="text-xs text-zinc-500 hover:text-red-400">Rimuovi</button>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-zinc-400 text-sm font-medium">Aggiungi eccezione</p>
          <Input type="date" min={today} value={excDate} onChange={e => setExcDate(e.target.value)} />
          <label className="flex items-center gap-2 text-zinc-300 text-sm">
            <input type="checkbox" checked={excOff} onChange={e => setExcOff(e.target.checked)} className="accent-amber-500" />
            Giorno libero
          </label>
          {!excOff && (
            <div className="flex gap-2">
              <Input type="time" value={excStart} onChange={e => setExcStart(e.target.value)} className="flex-1" />
              <span className="text-zinc-500 self-center">—</span>
              <Input type="time" value={excEnd} onChange={e => setExcEnd(e.target.value)} className="flex-1" />
            </div>
          )}
          <Input placeholder="Motivo (opzionale)" value={excReason} onChange={e => setExcReason(e.target.value)} />
          <Button onClick={async () => {
            await addExc.mutateAsync({ date: excDate, is_off: excOff, start_time: excOff ? null : excStart || null, end_time: excOff ? null : excEnd || null, reason: excReason || null })
            setExcDate(''); setExcOff(false); setExcStart(''); setExcEnd(''); setExcReason('')
          }} disabled={addExc.isPending || !excDate} className="bg-amber-500 text-zinc-950">
            Aggiungi
          </Button>
        </div>
      </section>
    </div>
  )
}
