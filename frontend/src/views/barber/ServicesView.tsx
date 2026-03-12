import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { useBarberServices, useAddService, useDeleteService } from '@/hooks/useServices'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ServicesView() {
  const { user } = useAuth()
  const { data: barbers } = useShopBarbers(user?.shopId ?? '')
  const barberId = barbers?.find(b => b.user_id === user?.userId)?.id ?? ''

  const { data: services, isLoading } = useBarberServices(barberId)
  const addSvc = useAddService(barberId)
  const deleteSvc = useDeleteService(barberId)
  const [name, setName] = useState('')
  const [dur, setDur] = useState('')
  const [price, setPrice] = useState('')

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-50 mb-6">I miei servizi</h1>
      {isLoading && <Skeleton className="h-32 w-full mb-4" />}
      <div className="space-y-2 mb-6">
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
        <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="Durata (min)" type="number" value={dur} onChange={e => setDur(e.target.value)} className="flex-1" />
          <Input placeholder="Prezzo (€)" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="flex-1" />
        </div>
        <Button onClick={async () => {
          await addSvc.mutateAsync({ name, duration_minutes: Number(dur), price: price ? Number(price) : undefined })
          setName(''); setDur(''); setPrice('')
        }} disabled={addSvc.isPending || !name || !dur || !barberId} className="bg-amber-500 text-zinc-950">
          Aggiungi
        </Button>
      </div>
    </div>
  )
}
