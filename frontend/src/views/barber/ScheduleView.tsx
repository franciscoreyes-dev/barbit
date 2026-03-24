import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { useSchedule, useUpsertSchedule, useExceptions, useAddException, useDeleteException } from '@/hooks/useAvailability'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SAVE_SUCCESS_MS } from '@/lib/constants'
import { Save, Plus, X } from 'lucide-react'
import type { ApiScheduleDay, ApiException } from '@/types'

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

const DEFAULT_SCHEDULE: ApiScheduleDay[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i, start_time: '09:00', end_time: '18:00', is_working: i >= 1 && i <= 5,
}))

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ScheduleView() {
  const { user } = useAuth()
  const { data: barbers } = useShopBarbers(user?.shopId ?? '')
  const barberId = barbers?.find(b => b.user_id === user?.userId)?.id ?? ''

  const { data: schedule, isLoading: loadingSched } = useSchedule(barberId)
  const upsertSched = useUpsertSchedule(barberId)
  const [editedSched, setEditedSched] = useState<ApiScheduleDay[]>(DEFAULT_SCHEDULE)
  const [schedSaved, setSchedSaved] = useState(false)
  useEffect(() => {
    if (schedule && schedule.length > 0) setEditedSched(schedule)
  }, [schedule])

  const today = toDateStr(new Date())
  const in30 = toDateStr(new Date(Date.now() + 30 * 86400000))
  const { data: exceptions, isLoading: loadingExc } = useExceptions(barberId, today, in30)
  const addExc = useAddException(barberId)
  const deleteExc = useDeleteException(barberId)
  const [excDate, setExcDate] = useState('')
  const [excOff, setExcOff] = useState(false)
  const [excStart, setExcStart] = useState('')
  const [excEnd, setExcEnd] = useState('')
  const [excReason, setExcReason] = useState('')
  const [confirmState, setConfirmState] = useState<{ action: () => void; title: string; desc: string } | null>(null)
  const closeConfirm = useCallback(() => setConfirmState(null), [])
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timeoutRefs.current.forEach(clearTimeout), [])
  function safeTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms)
    timeoutRefs.current.push(id)
  }

  return (
    <div className="space-y-10">
      <section aria-label="Orario settimanale">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Orario settimanale</h1>
        {loadingSched && <Skeleton className="h-48 w-full" />}
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 mb-4 shadow-sm">
          {editedSched.map((day, i) => (
            <div key={day.day_of_week} className="flex flex-wrap items-center gap-2 md:gap-3 px-3 md:px-4 py-3 min-h-[52px] animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
              <input type="checkbox" checked={day.is_working}
                onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, is_working: e.target.checked } : d))}
                aria-label={`${DAY_NAMES[day.day_of_week]} lavorativo`}
                className="accent-blue-600 w-5 h-5" />
              <span className="text-slate-700 text-sm w-20 md:w-24">{DAY_NAMES[day.day_of_week]}</span>
              {day.is_working && (
                <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0 ml-7 md:ml-0">
                  <label className="sr-only" htmlFor={`b-start-${i}`}>Orario inizio {DAY_NAMES[day.day_of_week]}</label>
                  <Input id={`b-start-${i}`} type="time" value={day.start_time}
                    onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, start_time: e.target.value } : d))}
                    className="flex-1 md:w-28 md:flex-none text-sm" />
                  <span className="text-slate-400 text-sm" aria-hidden="true">—</span>
                  <label className="sr-only" htmlFor={`b-end-${i}`}>Orario fine {DAY_NAMES[day.day_of_week]}</label>
                  <Input id={`b-end-${i}`} type="time" value={day.end_time}
                    onChange={e => setEditedSched(prev => prev.map((d, j) => j === i ? { ...d, end_time: e.target.value } : d))}
                    className="flex-1 md:w-28 md:flex-none text-sm" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={async () => { await upsertSched.mutateAsync(editedSched); setSchedSaved(true); safeTimeout(() => setSchedSaved(false), SAVE_SUCCESS_MS) }}
            disabled={upsertSched.isPending || !barberId}>
            <Save className="w-4 h-4 mr-1" />{upsertSched.isPending ? 'Salvataggio...' : 'Salva orario'}
          </Button>
          {schedSaved && <span className="text-emerald-600 text-sm animate-fade-in" role="status">Salvato!</span>}
        </div>
      </section>

      <section aria-label="Eccezioni">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Eccezioni (prossimi 30 giorni)</h2>
        {loadingExc && <Skeleton className="h-24 w-full" />}
        {exceptions?.length === 0 && !loadingExc && (
          <p className="text-slate-500 text-sm mb-4">Nessuna eccezione impostata.</p>
        )}
        <div className="space-y-2 mb-4">
          {exceptions?.map((exc: ApiException, i: number) => (
            <div key={exc.date} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
              <div className="min-w-0">
                <p className="text-slate-900 text-sm truncate">{exc.date} · {exc.is_off ? 'Giorno libero' : `${exc.start_time}–${exc.end_time}`}</p>
                {exc.reason && <p className="text-slate-500 text-xs truncate">{exc.reason}</p>}
              </div>
              <button onClick={() => setConfirmState({ action: () => { deleteExc.mutate(exc.date); setConfirmState(null) }, title: `Rimuovere eccezione del ${exc.date}?`, desc: 'L\'eccezione verrà eliminata.' })}
                disabled={deleteExc.isPending} aria-label={`Rimuovi eccezione del ${exc.date}`}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 min-h-[36px] px-2 shrink-0 transition-colors duration-150">
                <X className="w-3.5 h-3.5" /><span className="hidden md:inline">Rimuovi</span>
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault()
          await addExc.mutateAsync({ date: excDate, is_off: excOff, start_time: excOff ? null : excStart || null, end_time: excOff ? null : excEnd || null, reason: excReason || null })
          setExcDate(''); setExcOff(false); setExcStart(''); setExcEnd(''); setExcReason('')
        }} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Aggiungi eccezione</p>
          <Input type="date" min={today} value={excDate} onChange={e => setExcDate(e.target.value)} required aria-label="Data eccezione" />
          <label className="flex items-center gap-2 text-slate-700 text-sm min-h-[44px]">
            <input type="checkbox" checked={excOff} onChange={e => setExcOff(e.target.checked)} className="accent-blue-600 w-5 h-5" />
            Giorno libero
          </label>
          {!excOff && (
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="b-exc-start">Orario inizio eccezione</label>
              <Input id="b-exc-start" type="time" value={excStart} onChange={e => setExcStart(e.target.value)} className="flex-1" />
              <span className="text-slate-400 self-center" aria-hidden="true">—</span>
              <label className="sr-only" htmlFor="b-exc-end">Orario fine eccezione</label>
              <Input id="b-exc-end" type="time" value={excEnd} onChange={e => setExcEnd(e.target.value)} className="flex-1" />
            </div>
          )}
          <Input placeholder="Motivo (opzionale)" value={excReason} onChange={e => setExcReason(e.target.value)} aria-label="Motivo eccezione" />
          <Button type="submit" disabled={addExc.isPending || !excDate || !barberId}>
            <Plus className="w-4 h-4 mr-1" />{addExc.isPending ? 'Aggiunta...' : 'Aggiungi'}
          </Button>
        </form>
      </section>
      <ConfirmDialog open={!!confirmState} title={confirmState?.title ?? ''} description={confirmState?.desc}
        onConfirm={() => confirmState?.action()} onCancel={closeConfirm} confirmLabel="Conferma" variant="destructive" />
    </div>
  )
}
