import { useParams, useNavigate } from 'react-router-dom'
import { useShopBySlug } from '@/hooks/useShops'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { BarberAvatar } from '@/components/ui/barber-avatar'
import type { ApiBarber } from '@/types'

function BarberCard({ barber, shopId }: { barber: ApiBarber; shopId: string }) {
  const navigate = useNavigate()
  const active = barber.services.filter(s => s.is_active)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <BarberAvatar name={barber.name} avatarUrl={barber.avatar_url} size="lg" />
          <div>
            <p className="font-semibold text-slate-900">{barber.name}</p>
            <p className="text-slate-400 text-xs">{active.length} servizi</p>
          </div>
        </div>
        <Button onClick={() => navigate(`/book/${barber.id}`, { state: { shopId, barberName: barber.name } })}
          className="text-sm px-4 py-1.5">
          Prenota
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map(svc => (
          <span key={svc.id} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-1">
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
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-lg mx-auto pt-6 space-y-4">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" />
        {[1,2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    </main>
  )
  if (isError || !data) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-red-600">Negozio non trovato.</p>
    </main>
  )
  const { shop, barbers } = data
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-6">
        <h1 className="text-2xl font-bold mb-1">{shop.name}</h1>
        {shop.city && <p className="text-slate-500 text-sm mb-1">{shop.city}</p>}
        {shop.address && <p className="text-slate-400 text-xs mb-4">{shop.address}</p>}
        <h2 className="text-lg font-semibold mb-3">Barbieri</h2>
        <div className="space-y-4">
          {barbers.map((b, i) => <div key={b.id} className="animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}><BarberCard barber={b} shopId={shop.id} /></div>)}
        </div>
      </div>
    </main>
  )
}
