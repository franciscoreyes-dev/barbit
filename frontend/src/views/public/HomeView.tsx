import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopSearch } from '@/hooks/useShops'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiShop } from '@/types'

function ShopCard({ shop }: { shop: ApiShop }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(`/shop/${shop.slug}`)}
      className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-500 transition-colors">
      <p className="font-semibold text-zinc-50">{shop.name}</p>
      {shop.city && <p className="text-zinc-400 text-sm">{shop.city}</p>}
      {shop.address && <p className="text-zinc-500 text-xs">{shop.address}</p>}
    </button>
  )
}

export default function HomeView() {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const { data: shops, isLoading, isError } = useShopSearch(q, city)
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4">
      <div className="max-w-lg mx-auto pt-12">
        <h1 className="text-3xl font-bold text-amber-500 mb-2">Barbit</h1>
        <p className="text-zinc-400 mb-8">Trova il tuo barbiere</p>
        <div className="space-y-3 mb-6">
          <input type="text" placeholder="Cerca per nome..." value={q} onChange={e => setQ(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-amber-500" />
          <input type="text" placeholder="Cerca per città..." value={city} onChange={e => setCity(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-amber-500" />
        </div>
        {isLoading && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}
        {isError && <p className="text-red-400 text-sm">Errore nel caricamento. Riprova.</p>}
        {shops?.length === 0 && (q.length >= 2 || city.length >= 2) && (
          <p className="text-zinc-400 text-sm">Nessun negozio trovato.</p>
        )}
        <div className="space-y-3">{shops?.map(s => <ShopCard key={s.id} shop={s} />)}</div>
      </div>
    </main>
  )
}
