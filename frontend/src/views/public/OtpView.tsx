import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { InputOTP } from '@/components/ui/input-otp'
import api from '@/lib/api'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface BookingState {
  shopId: string; barberId: string; barberName: string
  serviceId: string; serviceName: string; price?: string | null
  startTime: string; phone: string; customerName?: string
}
interface ConfirmedAppt { id: string; start_time: string; end_time: string }

export default function OtpView() {
  const state = useLocation().state as BookingState | null
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appt, setAppt] = useState<ConfirmedAppt | null>(null)

  if (!state) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 mb-4">Sessione scaduta.</p>
        <Button onClick={() => navigate('/')} className="min-h-[44px]">Torna alla home</Button>
      </div>
    </main>
  )

  async function verifyAndBook() {
    if (code.length !== 6) { setError('Inserisci il codice a 6 cifre'); return }
    setError(''); setLoading(true)
    try {
      const { data: { token } } = await api.post<{ token: string }>('/auth/otp/verify', {
        phone: state!.phone, code, shopId: state!.shopId, name: state!.customerName,
      })
      const { data } = await api.post<ConfirmedAppt>('/appointments', {
        barberId: state!.barberId, serviceId: state!.serviceId, startTime: state!.startTime,
      }, { headers: { Authorization: `Bearer ${token}` } })
      setAppt(data)
    } catch (err: unknown) {
      const errCode = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      setError(
        errCode === 'SLOT_TAKEN' ? 'Slot già prenotato. Torna indietro e scegli un altro orario.' :
        errCode === 'INVALID_OTP' ? 'Codice errato o scaduto. Riprova.' :
        'Errore durante la prenotazione. Riprova.'
      )
    } finally { setLoading(false) }
  }

  if (appt) {
    const start = new Date(appt.start_time)
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 p-4 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4 animate-fade-in-up" style={{ '--stagger': 0 } as React.CSSProperties} aria-hidden="true">✓</div>
          <h1 className="text-2xl font-bold text-blue-600 mb-6 animate-fade-in-up" style={{ '--stagger': 1 } as React.CSSProperties}>Prenotazione confermata!</h1>
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-left mb-6 shadow-sm animate-fade-in-up" style={{ '--stagger': 2 } as React.CSSProperties}>
            {([['Barbiere', state.barberName], ['Servizio', state.serviceName],
              ['Data', format(start, 'EEEE d MMMM', { locale: it })],
              ['Ora', format(start, 'HH:mm')]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-slate-500 text-sm">{l}</span>
                <span className="text-slate-900 text-sm">{v}</span>
              </div>
            ))}
            {state.price && (
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500 text-sm">Prezzo</span>
                <span className="text-blue-600 font-semibold">€{state.price}</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 text-sm mb-4">Riceverai un SMS di conferma.</p>
          <Button onClick={() => navigate('/')} className="w-full min-h-[44px]">Torna alla home</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-sm mx-auto pt-12">
        <h1 className="text-2xl font-bold mb-2">Verifica il numero</h1>
        <p className="text-slate-500 text-sm mb-8">Codice inviato al {state.phone}</p>
        <div className="mb-4" aria-describedby={error ? 'otp-error' : undefined}>
          <InputOTP value={code} onChange={setCode} />
        </div>
        {error && <p id="otp-error" className="text-red-600 text-sm mb-4 animate-fade-in" role="alert">{error}</p>}
        <Button onClick={verifyAndBook} disabled={loading || code.length !== 6}
          className="w-full min-h-[44px]">
          {loading ? 'Verifica...' : 'Conferma prenotazione'}
        </Button>
        <button onClick={() => navigate(-1)} className="mt-4 w-full text-center text-slate-500 text-sm hover:text-slate-900 min-h-[44px] transition-colors duration-150" aria-label="Torna alla pagina precedente">
          ← Indietro
        </button>
      </div>
    </main>
  )
}
