import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'Minimo 8 caratteri'),
  shopName: z.string().min(2, 'Nome negozio obbligatorio'),
  shopCity: z.string().min(2, 'Città obbligatoria'),
  ownerName: z.string().min(2, 'Nome obbligatorio'),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterView() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      api.post<{ token: string }>('/auth/register', data).then(r => r.data),
    onSuccess: ({ token }) => {
      login(token)
      navigate('/owner/dashboard')
    },
  })

  const apiError = mutation.error as { response?: { data?: { code?: string } } } | null
  const errorCode = apiError?.response?.data?.code

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Registra il tuo negozio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="ownerName">Il tuo nome</Label>
              <Input id="ownerName" placeholder="Mario Rossi" {...register('ownerName')} />
              {errors.ownerName && <p className="text-red-600 text-xs">{errors.ownerName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="shopName">Nome negozio</Label>
              <Input id="shopName" placeholder="Barberia Mario" {...register('shopName')} />
              {errors.shopName && <p className="text-red-600 text-xs">{errors.shopName.message}</p>}
              {errorCode === 'SLUG_TAKEN' && (
                <p className="text-red-600 text-xs animate-fade-in" role="alert">Nome negozio già in uso, prova con un nome diverso</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="shopCity">Città</Label>
              <Input id="shopCity" placeholder="Roma" {...register('shopCity')} />
              {errors.shopCity && <p className="text-red-600 text-xs">{errors.shopCity.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="owner@barberia.it" {...register('email')} />
              {errors.email && <p className="text-red-600 text-xs">{errors.email.message}</p>}
              {errorCode === 'EMAIL_TAKEN' && <p className="text-red-600 text-xs animate-fade-in" role="alert">Email già in uso</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-600 text-xs">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Registrazione...' : 'Crea negozio'}
            </Button>
            <p className="text-center text-slate-500 text-sm">
              Hai già un account?{' '}
              <Link to="/auth/login" className="text-blue-600 hover:underline">Accedi</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
