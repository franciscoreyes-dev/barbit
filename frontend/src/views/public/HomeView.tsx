import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopSearch } from '@/hooks/useShops'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import type { ApiShop } from '@/types'

function ShopCard({ shop }: { shop: ApiShop }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(`/shop/${shop.slug}`)}
      aria-label={`Vai a ${shop.name}${shop.city ? `, ${shop.city}` : ''}`}
      className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition-all min-h-[64px]">
      <p className="font-semibold text-slate-900 truncate">{shop.name}</p>
      {shop.city && <p className="text-slate-500 text-sm truncate">{shop.city}</p>}
      {shop.address && <p className="text-slate-400 text-xs truncate">{shop.address}</p>}
    </button>
  )
}

export default function HomeView() {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const { data: shops, isLoading, isError } = useShopSearch(q, city)
  const hasQuery = q.length >= 2 || city.length >= 2

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-12">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">Barbit</h1>
        <p className="text-slate-500 mb-8">Trova il tuo barbiere</p>
        <div className="space-y-3 mb-6" role="search">
          <label htmlFor="search-name" className="sr-only">Cerca per nome</label>
          <Input id="search-name" type="text" placeholder="Cerca per nome..." value={q} onChange={e => setQ(e.target.value)} />
          <label htmlFor="search-city" className="sr-only">Cerca per città</label>
          <Input id="search-city" type="text" placeholder="Cerca per città..." value={city} onChange={e => setCity(e.target.value)} />
        </div>
        {isLoading && <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}
        {isError && <p className="text-red-600 text-sm" role="alert">Errore nel caricamento. Riprova.</p>}
        {shops?.length === 0 && hasQuery && (
          <p className="text-slate-500 text-sm">Nessun negozio trovato. Prova con un'altra ricerca.</p>
        )}
        {!hasQuery && !isLoading && (
          <p className="text-slate-400 text-sm">Inserisci almeno 2 caratteri per cercare.</p>
        )}
        <div className="space-y-3">{shops?.map((s, i) => <div key={s.id} className="animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}><ShopCard shop={s} /></div>)}</div>
      </div>
    </main>
  )
}
