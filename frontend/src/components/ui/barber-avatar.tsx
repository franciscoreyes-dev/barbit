import { cn } from '@/lib/utils'

const PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500', hex: '#3b82f6' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-500', hex: '#10b981' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-500', hex: '#8b5cf6' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500', hex: '#f59e0b' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-500', hex: '#f43f5e' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-500', hex: '#06b6d4' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', hex: '#f97316' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-500', hex: '#6366f1' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-500', hex: '#14b8a6' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-500', hex: '#ec4899' },
] as const

function hashName(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash)
}

export function getBarberColor(name: string) {
  return PALETTE[hashName(name) % PALETTE.length]
}

const SIZE_MAP = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-lg',
} as const

interface BarberAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BarberAvatar({ name, avatarUrl, size = 'md', className }: BarberAvatarProps) {
  const color = getBarberColor(name)
  const sizeClass = SIZE_MAP[size]
  const initial = name.charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(sizeClass, 'rounded-full object-cover flex-shrink-0', className)}
      />
    )
  }

  return (
    <span
      className={cn(sizeClass, color.bg, color.text, 'rounded-full flex items-center justify-center font-semibold flex-shrink-0', className)}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}
