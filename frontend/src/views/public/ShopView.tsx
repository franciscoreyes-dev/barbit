import { useParams, useNavigate } from 'react-router-dom'
import { useShopBySlug } from '@/hooks/useShops'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { ApiBarber } from '@/types'

function BarberCard({ barber, shopId }: { barber: ApiBarber; shopId: string }) {
  const navigate = useNavigate()
  const active = barber.services.filter(s => s.is_active)
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-zinc-50">{barber.name}</p>
          <p className="text-zinc-500 text-xs">{active.length} servizi</p>
        </div>
        <Button onClick={() => navigate(`/book/${barber.id}`, { state: { shopId, barberName: barber.name } })}
          className="bg-amber-500 text-zinc-950 hover:bg-amber-400 text-sm px-4 py-1.5">
          Prenota
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map(svc => (
          <span key={svc.id} className="text-xs bg-zinc-800 text-zinc-300 rounded px-2 py-1">
            {svc.name} · {svc.duration_minutes}min{svc.price ? ` · €${svc.price}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ShopView() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, isError } = useShopBySlug(slug ?? '')
  if (isLoading) return (
    <main className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-lg mx-auto pt-6 space-y-4">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" />
        {[1,2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    </main>
  )
  if (isError || !data) return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-red-400">Negozio non trovato.</p>
    </main>
  )
  const { shop, barbers } = data
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <h1 className="text-2xl font-bold mb-1">{shop.name}</h1>
        {shop.city && <p className="text-zinc-400 text-sm mb-1">{shop.city}</p>}
        {shop.address && <p className="text-zinc-500 text-xs mb-4">{shop.address}</p>}
        <h2 className="text-lg font-semibold mb-3">Barbieri</h2>
        <div className="space-y-4">
          {barbers.map(b => <BarberCard key={b.id} barber={b} shopId={shop.id} />)}
        </div>
      </div>
    </main>
  )
}
