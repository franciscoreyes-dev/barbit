import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopBarbers } from '@/hooks/useBarbers'
import { useBarberServices, useAddService, useDeleteService, useReactivateService, useHardDeleteService } from '@/hooks/useServices'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, PowerOff, Trash2, RotateCcw } from 'lucide-react'

export default function ServicesView() {
  const { user } = useAuth()
  const { data: barbers } = useShopBarbers(user?.shopId ?? '')
  const barberId = barbers?.find(b => b.user_id === user?.userId)?.id ?? ''

  const { data: services, isLoading, isError } = useBarberServices(barberId)
  const addSvc = useAddService(barberId)
  const deactivateSvc = useDeleteService(barberId)
  const reactivateSvc = useReactivateService(barberId)
  const hardDeleteSvc = useHardDeleteService(barberId)
  const [name, setName] = useState('')
  const [dur, setDur] = useState('')
  const [price, setPrice] = useState('')
  const [confirmState, setConfirmState] = useState<{ action: () => void; title: string; desc: string } | null>(null)
  const closeConfirm = useCallback(() => setConfirmState(null), [])

  const activeServices = services?.filter(s => s.is_active) ?? []
  const inactiveServices = services?.filter(s => !s.is_active) ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">I miei servizi</h1>
      {isLoading && <Skeleton className="h-32 w-full mb-4" />}
      {isError && <p className="text-red-600 text-sm mb-4" role="alert">Errore nel caricamento dei servizi.</p>}

      {activeServices.length > 0 && (
        <div className="space-y-2 mb-6">
          {activeServices.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm animate-fade-in-up" style={{ '--stagger': i } as React.CSSProperties}>
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-medium truncate">{s.name}</p>
                <p className="text-slate-500 text-xs">{s.duration_minutes}min{s.price ? ` · €${s.price}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setConfirmState({ action: () => { deactivateSvc.mutate(s.id); setConfirmState(null) }, title: `Disattivare "${s.name}"?`, desc: 'Il servizio non sarà più visibile ai clienti.' })}
                  disabled={deactivateSvc.isPending} aria-label={`Disattiva servizio ${s.name}`}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 min-h-[36px] px-2 transition-colors duration-150">
                  <PowerOff className="w-3.5 h-3.5" /><span className="hidden md:inline">Disattiva</span>
                </button>
                <button onClick={() => setConfirmState({ action: () => { hardDeleteSvc.mutate(s.id); setConfirmState(null) }, title: `Eliminare "${s.name}"?`, desc: 'Questa azione è irreversibile.' })}
                  disabled={hardDeleteSvc.isPending} aria-label={`Elimina definitivamente servizio ${s.name}`}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 min-h-[36px] px-2 transition-colors duration-150">
                  <Trash2 className="w-3.5 h-3.5" /><span className="hidden md:inline">Elimina</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {inactiveServices.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Disattivati</p>
          {inactiveServices.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 opacity-60">
              <div className="min-w-0">
                <p className="text-slate-500 text-sm font-medium truncate">{s.name}</p>
                <p className="text-slate-400 text-xs">{s.duration_minutes}min{s.price ? ` · €${s.price}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => reactivateSvc.mutate(s.id)}
                  disabled={reactivateSvc.isPending} aria-label={`Riattiva servizio ${s.name}`}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-500 min-h-[36px] px-2 transition-colors duration-150">
                  <RotateCcw className="w-3.5 h-3.5" /><span className="hidden md:inline">Attiva</span>
                </button>
                <button onClick={() => setConfirmState({ action: () => { hardDeleteSvc.mutate(s.id); setConfirmState(null) }, title: `Eliminare "${s.name}"?`, desc: 'Questa azione è irreversibile.' })}
                  disabled={hardDeleteSvc.isPending} aria-label={`Elimina definitivamente servizio ${s.name}`}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 min-h-[36px] px-2 transition-colors duration-150">
                  <Trash2 className="w-3.5 h-3.5" /><span className="hidden md:inline">Elimina</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeServices.length === 0 && inactiveServices.length === 0 && !isLoading && !isError && (
        <p className="text-slate-500 text-sm mb-4">Nessun servizio. Aggiungine uno qui sotto.</p>
      )}

      <form onSubmit={async (e) => {
        e.preventDefault()
        await addSvc.mutateAsync({ name, duration_minutes: Number(dur), price: price ? Number(price) : undefined })
        setName(''); setDur(''); setPrice('')
      }} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
        <p className="text-slate-500 text-sm font-medium">Aggiungi servizio</p>
        <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} required aria-label="Nome servizio" />
        <div className="flex gap-2">
          <Input placeholder="Durata (min)" type="number" min="1" value={dur} onChange={e => setDur(e.target.value)} className="flex-1" required aria-label="Durata in minuti" />
          <Input placeholder="Prezzo (€)" type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="flex-1" aria-label="Prezzo in euro" />
        </div>
        <Button type="submit" disabled={addSvc.isPending || !name || !dur || !barberId}>
          <Plus className="w-4 h-4 mr-1" />{addSvc.isPending ? 'Aggiunta...' : 'Aggiungi'}
        </Button>
      </form>
      <ConfirmDialog open={!!confirmState} title={confirmState?.title ?? ''} description={confirmState?.desc}
        onConfirm={() => confirmState?.action()} onCancel={closeConfirm} confirmLabel="Conferma" variant="destructive" />
    </div>
  )
}
