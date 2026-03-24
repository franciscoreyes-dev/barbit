import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers, useInviteBarber, useUpdateBarber, useDeleteBarber } from '@/hooks/useBarbers'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarberAvatar } from '@/components/ui/barber-avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Send, Power, PowerOff, Settings, Trash2 } from 'lucide-react'

export default function BarbersView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: barbers, isLoading, isError } = useShopBarbers(user?.shopId ?? '')
  const invite = useInviteBarber()
  const update = useUpdateBarber(user?.shopId ?? '')
  const remove = useDeleteBarber(user?.shopId ?? '')
  const [email, setEmail] = useState('')
  const [invited, setInvited] = useState(false)
  const [confirmState, setConfirmState] = useState<{ action: () => void; title: string; desc: string } | null>(null)
  const closeConfirm = useCallback(() => setConfirmState(null), [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Barbieri</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-6 shadow-sm">
        <p className="text-slate-500 text-sm font-medium mb-3">Invita un barbiere</p>
        <form onSubmit={async (e) => { e.preventDefault(); await invite.mutateAsync({ email }); setInvited(true); setEmail('') }}
          className="flex gap-2">
          <label htmlFor="invite-email" className="sr-only">Email del barbiere</label>
          <Input id="invite-email" type="email" placeholder="email@barbiere.it" value={email}
            onChange={e => setEmail(e.target.value)} className="flex-1" required />
          <Button type="submit" disabled={invite.isPending || !email}>
            <Send className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">{invite.isPending ? 'Invio...' : 'Invita'}</span>
          </Button>
        </form>
        {invited && <p className="text-emerald-600 text-xs mt-2 animate-fade-in" role="status">Invito inviato!</p>}
        {invite.isError && <p className="text-red-600 text-xs mt-2 animate-fade-in" role="alert">Errore nell'invio dell'invito.</p>}
      </div>
      {isLoading && <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento dei barbieri.</p>}
      {!isLoading && barbers?.length === 0 && (
        <p className="text-slate-500 text-sm">Nessun barbiere ancora. Invita il primo!</p>
      )}
      <div className="space-y-3">
        {barbers?.map((b, i) => (
          <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2 md:mb-0">
              <div className="flex items-center gap-3 min-w-0">
                <BarberAvatar name={b.name} avatarUrl={b.avatar_url} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{b.name}</p>
                  <p className={`text-xs ${b.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {b.is_active ? 'Attivo' : 'Inattivo'}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex gap-2 shrink-0">
                <Button size="sm" variant="outline"
                  onClick={() => update.mutate({ id: b.id, is_active: !b.is_active })}
                  disabled={update.isPending}
                  aria-label={b.is_active ? `Disattiva ${b.name}` : `Attiva ${b.name}`}
                  className="min-h-[36px]">
                  {b.is_active ? <><PowerOff className="w-3.5 h-3.5 mr-1" />Disattiva</> : <><Power className="w-3.5 h-3.5 mr-1" />Attiva</>}
                </Button>
                <Button size="sm"
                  onClick={() => navigate(`/owner/barbers/${b.id}`)}
                  aria-label={`Gestisci ${b.name}`}
                  className="min-h-[36px]"><Settings className="w-3.5 h-3.5 mr-1" />Gestisci</Button>
                <Button size="sm" variant="destructive"
                  onClick={() => setConfirmState({ action: () => { remove.mutate(b.id); setConfirmState(null) }, title: `Rimuovere ${b.name}?`, desc: 'Questa azione è irreversibile.' })}
                  disabled={remove.isPending}
                  aria-label={`Elimina ${b.name}`}
                  className="min-h-[36px]"><Trash2 className="w-3.5 h-3.5 mr-1" />Elimina</Button>
              </div>
            </div>
            <div className="flex gap-2 md:hidden">
              <Button size="sm" variant="outline"
                onClick={() => update.mutate({ id: b.id, is_active: !b.is_active })}
                disabled={update.isPending}
                aria-label={b.is_active ? `Disattiva ${b.name}` : `Attiva ${b.name}`}
                className="min-h-[36px]">
                {b.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </Button>
              <Button size="sm"
                onClick={() => navigate(`/owner/barbers/${b.id}`)}
                aria-label={`Gestisci ${b.name}`}
                className="min-h-[36px] flex-1"><Settings className="w-4 h-4 mr-1" />Gestisci</Button>
              <Button size="sm" variant="destructive"
                onClick={() => setConfirmState({ action: () => { remove.mutate(b.id); setConfirmState(null) }, title: `Rimuovere ${b.name}?`, desc: 'Questa azione è irreversibile.' })}
                disabled={remove.isPending}
                aria-label={`Elimina ${b.name}`}
                className="min-h-[36px]"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!confirmState} title={confirmState?.title ?? ''} description={confirmState?.desc}
        onConfirm={() => confirmState?.action()} onCancel={closeConfirm} confirmLabel="Elimina" variant="destructive" />
    </div>
  )
}
