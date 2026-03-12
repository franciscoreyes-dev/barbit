import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface BookingState {
  shopId: string; barberId: string; barberName: string
  serviceId: string; serviceName: string; price?: string | null
  startTime: string; phone: string
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
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-400 mb-4">Sessione scaduta.</p>
        <Button onClick={() => navigate('/')} className="bg-amber-500 text-zinc-950">Torna alla home</Button>
      </div>
    </main>
  )

  async function verifyAndBook() {
    if (code.length !== 6) { setError('Inserisci il codice a 6 cifre'); return }
    setError(''); setLoading(true)
    try {
      const { data: { token } } = await api.post<{ token: string }>('/auth/otp/verify', {
        phone: state!.phone, code, shopId: state!.shopId,
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
      <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-amber-500 mb-6">Prenotazione confermata!</h1>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-left mb-6">
            {([['Barbiere', state.barberName], ['Servizio', state.serviceName],
              ['Data', format(start, 'EEEE d MMMM', { locale: it })],
              ['Ora', format(start, 'HH:mm')]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-zinc-400 text-sm">{l}</span>
                <span className="text-zinc-50 text-sm">{v}</span>
              </div>
            ))}
            {state.price && (
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-400 text-sm">Prezzo</span>
                <span className="text-amber-500 font-semibold">€{state.price}</span>
              </div>
            )}
          </div>
          <p className="text-zinc-400 text-sm mb-4">Riceverai un SMS di conferma.</p>
          <Button onClick={() => navigate('/')} className="w-full bg-amber-500 text-zinc-950">Torna alla home</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-sm mx-auto pt-12">
        <h1 className="text-2xl font-bold mb-2">Verifica il numero</h1>
        <p className="text-zinc-400 text-sm mb-8">Codice inviato al {state.phone}</p>
        <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full text-center text-3xl tracking-widest rounded-md border border-zinc-700 bg-zinc-900 px-3 py-4 text-zinc-50 focus:outline-none focus:border-amber-500 mb-4" />
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <Button onClick={verifyAndBook} disabled={loading || code.length !== 6}
          className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
          {loading ? 'Verifica...' : 'Conferma prenotazione'}
        </Button>
        <button onClick={() => navigate(-1)} className="mt-4 w-full text-center text-zinc-400 text-sm hover:text-zinc-50">
          ← Indietro
        </button>
      </div>
    </main>
  )
}
