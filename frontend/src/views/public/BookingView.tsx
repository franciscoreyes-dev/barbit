import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useBarberServices } from '@/hooks/useServices'
import { useSlots } from '@/hooks/useSlots'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type { ApiBarberService } from '@/types'

interface LocationState { shopId: string; barberName: string }

export default function BookingView() {
  const { barberId } = useParams<{ barberId: string }>()
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LocationState
  const [step, setStep] = useState<1|2|3>(1)
  const [service, setService] = useState<ApiBarberService | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneErr, setPhoneErr] = useState('')
  const [sending, setSending] = useState(false)

  const { data: services, isLoading: loadingSvc, isError: errSvc } = useBarberServices(barberId ?? '')
  const { data: slots, isLoading: loadingSlots, isError: errSlots } =
    useSlots(barberId ?? '', date, service?.id ?? '')
  const today = new Date().toISOString().split('T')[0]

  async function requestOtp() {
    if (!phone.match(/^\+?[0-9]{8,15}$/)) { setPhoneErr('Numero non valido (es. +393331234567)'); return }
    setPhoneErr(''); setSending(true)
    try {
      await api.post('/auth/otp/send', { phone, shopId: state.shopId })
      navigate(`/book/${barberId}/confirm`, {
        state: { shopId: state.shopId, barberName: state.barberName, barberId,
          serviceId: service!.id, serviceName: service!.name, price: service!.price, startTime: slot, phone },
      })
    } catch { setPhoneErr("Errore nell'invio dell'OTP. Riprova.") }
    finally { setSending(false) }
  }

  if (step === 1) return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <p className="text-zinc-400 text-sm mb-1">Barbiere: {state.barberName}</p>
        <h1 className="text-2xl font-bold mb-6">Scegli il servizio</h1>
        {loadingSvc && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}
        {errSvc && <p className="text-red-400 text-sm">Errore nel caricamento.</p>}
        <div className="space-y-3">
          {services?.filter(s => s.is_active).map(svc => (
            <button key={svc.id} onClick={() => { setService(svc); setStep(2) }}
              className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-500 transition-colors">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-zinc-50">{svc.name}</p>
                {svc.price && <p className="text-amber-500 font-semibold">€{svc.price}</p>}
              </div>
              <p className="text-zinc-400 text-sm">{svc.duration_minutes} minuti</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  )

  if (step === 2) return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <button onClick={() => setStep(1)} className="text-zinc-400 text-sm mb-4 hover:text-zinc-50">← Indietro</button>
        <h1 className="text-2xl font-bold mb-6">Scegli data e orario</h1>
        <div className="mb-6">
          <label className="block text-zinc-400 text-sm mb-2">Data</label>
          <input type="date" min={today} value={date}
            onChange={e => { setDate(e.target.value); setSlot('') }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 focus:outline-none focus:border-amber-500" />
        </div>
        {date && (
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Orario disponibile</label>
            {loadingSlots && <div className="grid grid-cols-3 gap-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10" />)}</div>}
            {errSlots && <p className="text-red-400 text-sm">Errore slot.</p>}
            {slots?.length === 0 && <p className="text-zinc-400 text-sm">Nessuno slot disponibile.</p>}
            <div className="grid grid-cols-3 gap-2">
              {slots?.map(s => (
                <button key={s} onClick={() => setSlot(s)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${slot === s ? 'bg-amber-500 text-zinc-950' : 'border border-zinc-700 text-zinc-300 hover:border-amber-500'}`}>
                  {format(new Date(s), 'HH:mm')}
                </button>
              ))}
            </div>
          </div>
        )}
        {slot && <Button onClick={() => setStep(3)} className="mt-6 w-full bg-amber-500 text-zinc-950">Continua</Button>}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <button onClick={() => setStep(2)} className="text-zinc-400 text-sm mb-4 hover:text-zinc-50">← Indietro</button>
        <h1 className="text-2xl font-bold mb-6">Riepilogo</h1>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2 mb-6">
          {([['Barbiere', state.barberName], ['Servizio', service?.name ?? ''],
            ['Data', format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: it })],
            ['Ora', format(new Date(slot), 'HH:mm')]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-zinc-400 text-sm">{l}</span><span className="text-zinc-50 text-sm">{v}</span>
            </div>
          ))}
          {service?.price && (
            <div className="flex justify-between border-t border-zinc-800 pt-2">
              <span className="text-zinc-400 text-sm">Prezzo</span>
              <span className="text-amber-500 font-semibold">€{service.price}</span>
            </div>
          )}
        </div>
        <div className="space-y-2 mb-4">
          <label className="block text-zinc-400 text-sm">Numero di telefono</label>
          <input type="tel" placeholder="+39 333 123 4567" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-amber-500" />
          {phoneErr && <p className="text-red-400 text-xs">{phoneErr}</p>}
        </div>
        <Button onClick={requestOtp} disabled={sending || !phone} className="w-full bg-amber-500 text-zinc-950">
          {sending ? 'Invio OTP...' : 'Ricevi codice via SMS'}
        </Button>
      </div>
    </main>
  )
}
