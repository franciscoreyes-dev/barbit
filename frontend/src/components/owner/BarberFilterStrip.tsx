import { BarberAvatar, getBarberColor } from '@/components/ui/barber-avatar'
import type { ApiBarber } from '@/types'

interface BarberFilterStripProps {
  barbers: ApiBarber[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: () => void
}

export function BarberFilterStrip({ barbers, selectedIds, onToggle, onToggleAll }: BarberFilterStripProps) {
  if (barbers.length <= 1) return null

  const allSelected = selectedIds.length === barbers.length

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" role="group" aria-label="Filtra per barbiere">
      <button onClick={onToggleAll}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] border transition-colors duration-150 ${
          allSelected ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-400'
        }`}>
        Tutti
      </button>
      {barbers.map(b => {
        const selected = selectedIds.includes(b.id)
        const color = getBarberColor(b.name)
        return (
          <button key={b.id} onClick={() => onToggle(b.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] border transition-colors duration-150 ${
              selected ? `${color.bg} ${color.border} ${color.text}` : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'
            }`}>
            <BarberAvatar name={b.name} avatarUrl={b.avatar_url} size="sm" className="!w-5 !h-5 !text-[10px]" />
            {b.name}
          </button>
        )
      })}
    </div>
  )
}
