import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useBarberServices } from '@/hooks/useServices'
import { useSlots } from '@/hooks/useSlots'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [customerName, setCustomerName] = useState('')
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
          serviceId: service!.id, serviceName: service!.name, price: service!.price, startTime: slot, phone,
          customerName: customerName.trim() || undefined },
      })
    } catch { setPhoneErr("Errore nell'invio dell'OTP. Riprova.") }
    finally { setSending(false) }
  }

  if (step === 1) return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <p className="text-slate-500 text-sm mb-1">Barbiere: {state.barberName}</p>
        <h1 className="text-2xl font-bold mb-6">Scegli il servizio</h1>
        {loadingSvc && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}
        {errSvc && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento dei servizi.</p>}
        {!loadingSvc && services?.filter(s => s.is_active).length === 0 && (
          <p className="text-slate-500 text-sm">Questo barbiere non ha ancora servizi disponibili.</p>
        )}
        <div className="space-y-3" role="radiogroup" aria-label="Scegli servizio">
          {services?.filter(s => s.is_active).map((svc, i) => (
            <button key={svc.id} onClick={() => { setService(svc); setStep(2) }}
              role="radio" aria-checked={service?.id === svc.id}
              style={{ '--stagger': i } as React.CSSProperties}
              aria-label={`${svc.name}, ${svc.duration_minutes} minuti${svc.price ? `, €${svc.price}` : ''}`}
              className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition-all min-h-[64px] animate-fade-in-up">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-slate-900">{svc.name}</p>
                {svc.price && <p className="text-blue-600 font-semibold">€{svc.price}</p>}
              </div>
              <p className="text-slate-500 text-sm">{svc.duration_minutes} minuti</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  )

  if (step === 2) return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <button onClick={() => setStep(1)} className="text-slate-500 text-sm mb-4 hover:text-slate-900 min-h-[44px] flex items-center transition-colors duration-150" aria-label="Torna alla scelta del servizio">← Indietro</button>
        <h1 className="text-2xl font-bold mb-6">Scegli data e orario</h1>
        <div className="mb-6">
          <label htmlFor="booking-date" className="block text-slate-500 text-sm mb-2">Data</label>
          <Input id="booking-date" type="date" min={today} value={date}
            onChange={e => { setDate(e.target.value); setSlot('') }} />
        </div>
        {date && (
          <div>
            <p className="text-slate-500 text-sm mb-2" id="slot-label">Orario disponibile</p>
            {loadingSlots && <div className="grid grid-cols-3 gap-2" role="status" aria-live="polite">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-11" />)}</div>}
            {errSlots && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento degli slot.</p>}
            {slots?.length === 0 && !loadingSlots && <p className="text-slate-500 text-sm">Nessuno slot disponibile per questa data.</p>}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="slot-label">
              {slots?.map((s, i) => (
                <button key={s} onClick={() => setSlot(s)}
                  role="radio" aria-checked={slot === s}
                  style={{ '--stagger': i } as React.CSSProperties}
                  className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] animate-fade-in-up ${slot === s ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700 hover:border-blue-400'}`}>
                  {format(new Date(s), 'HH:mm')}
                </button>
              ))}
            </div>
          </div>
        )}
        {slot && <Button onClick={() => setStep(3)} className="mt-6 w-full min-h-[44px]">Continua</Button>}
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <button onClick={() => setStep(2)} className="text-slate-500 text-sm mb-4 hover:text-slate-900 min-h-[44px] flex items-center transition-colors duration-150" aria-label="Torna alla scelta dell'orario">← Indietro</button>
        <h1 className="text-2xl font-bold mb-6">Riepilogo</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 mb-6 shadow-sm">
          {([['Barbiere', state.barberName], ['Servizio', service?.name ?? ''],
            ['Data', format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: it })],
            ['Ora', format(new Date(slot), 'HH:mm')]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-slate-500 text-sm">{l}</span><span className="text-slate-900 text-sm">{v}</span>
            </div>
          ))}
          {service?.price && (
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500 text-sm">Prezzo</span>
              <span className="text-blue-600 font-semibold">€{service.price}</span>
            </div>
          )}
        </div>
        <div className="space-y-2 mb-4">
          <label htmlFor="customer-name" className="block text-slate-500 text-sm">Il tuo nome</label>
          <Input id="customer-name" type="text" placeholder="Mario Rossi" value={customerName} onChange={e => setCustomerName(e.target.value)} />
        </div>
        <div className="space-y-2 mb-4">
          <label htmlFor="phone" className="block text-slate-500 text-sm">Numero di telefono</label>
          <Input id="phone" type="tel" placeholder="+39 333 123 4567" value={phone} onChange={e => setPhone(e.target.value)}
            aria-describedby={phoneErr ? 'phone-error' : undefined} />
          {phoneErr && <p id="phone-error" className="text-red-600 text-xs animate-fade-in" role="alert">{phoneErr}</p>}
        </div>
        <Button onClick={requestOtp} disabled={sending || !phone} className="w-full min-h-[44px]">
          {sending ? 'Invio OTP...' : 'Ricevi codice via SMS'}
        </Button>
      </div>
    </main>
  )
}
