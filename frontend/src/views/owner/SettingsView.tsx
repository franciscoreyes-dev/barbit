import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useMyShop, useUpdateShop } from '@/hooks/useShops'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(2, 'Nome obbligatorio'),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  timezone: z.string().min(1),
})
type Form = z.infer<typeof schema>

export default function SettingsView() {
  const { user } = useAuth()
  const { data: shop, isLoading } = useMyShop()
  const update = useUpdateShop(user?.shopId ?? '')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'Europe/Rome' },
  })
  useEffect(() => {
    if (shop) reset({ name: shop.name, city: shop.city ?? '', address: shop.address ?? '',
      phone: shop.phone ?? '', email: shop.email ?? '', timezone: shop.timezone })
  }, [shop, reset])

  const errCode = (update.error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code

  if (isLoading) return <div className="space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-50 mb-6">Impostazioni negozio</h1>
      <form onSubmit={handleSubmit(d => update.mutate(d))} className="space-y-4 max-w-md">
        {([
          { id: 'name' as const, label: 'Nome negozio', type: 'text', extra: errCode === 'SLUG_TAKEN' ? 'Nome già in uso' : undefined },
          { id: 'city' as const, label: 'Città', type: 'text' },
          { id: 'address' as const, label: 'Indirizzo', type: 'text' },
          { id: 'phone' as const, label: 'Telefono', type: 'tel' },
          { id: 'email' as const, label: 'Email', type: 'email' },
          { id: 'timezone' as const, label: 'Timezone', type: 'text' },
        ]).map(({ id, label, type, extra }) => (
          <div key={id} className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type={type} {...register(id)} />
            {errors[id] && <p className="text-red-400 text-xs">{errors[id]?.message}</p>}
            {extra && <p className="text-red-400 text-xs">{extra}</p>}
          </div>
        ))}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={update.isPending} className="bg-amber-500 text-zinc-950">
            {update.isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
          {update.isSuccess && <span className="text-green-400 text-sm">Salvato!</span>}
        </div>
      </form>
    </div>
  )
}
