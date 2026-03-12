import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers, useInviteBarber, useUpdateBarber } from '@/hooks/useBarbers'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function BarbersView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: barbers, isLoading, isError } = useShopBarbers(user?.shopId ?? '')
  const invite = useInviteBarber()
  const update = useUpdateBarber(user?.shopId ?? '')
  const [email, setEmail] = useState('')
  const [invited, setInvited] = useState(false)

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-50 mb-6">Barbieri</h1>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 mb-6">
        <p className="text-zinc-400 text-sm font-medium mb-3">Invita un barbiere</p>
        <div className="flex gap-2">
          <Input type="email" placeholder="email@barbiere.it" value={email}
            onChange={e => setEmail(e.target.value)} className="flex-1" />
          <Button onClick={async () => { await invite.mutateAsync({ email }); setInvited(true); setEmail('') }}
            disabled={invite.isPending || !email} className="bg-amber-500 text-zinc-950">Invita</Button>
        </div>
        {invited && <p className="text-green-400 text-xs mt-2">Invito inviato!</p>}
        {invite.isError && <p className="text-red-400 text-xs mt-2">Errore.</p>}
      </div>
      {isLoading && <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <p className="text-red-400 text-sm">Errore nel caricamento.</p>}
      <div className="space-y-3">
        {barbers?.map(b => (
          <div key={b.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-50">{b.name}</p>
              <p className={`text-xs ${b.is_active ? 'text-green-400' : 'text-zinc-500'}`}>
                {b.is_active ? 'Attivo' : 'Inattivo'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => update.mutate({ id: b.id, is_active: !b.is_active })}
                className="border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 text-xs">
                {b.is_active ? 'Disattiva' : 'Attiva'}
              </Button>
              <Button size="sm" onClick={() => navigate(`/owner/barbers/${b.id}`)}
                className="bg-amber-500 text-zinc-950 text-xs">Gestisci</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
