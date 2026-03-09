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

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginView() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const mutation = useMutation({
    mutationFn: (data: LoginForm) =>
      api.post<{ token: string }>('/auth/login', data).then(r => r.data),
    onSuccess: ({ token }) => {
      login(token)
      navigate('/owner/dashboard')
    },
  })

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accedi a Barbit</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="owner@barberia.it" {...register('email')} />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
            </div>
            {mutation.error && (
              <p className="text-red-400 text-sm">Credenziali non valide</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Accesso in corso...' : 'Accedi'}
            </Button>
            <p className="text-center text-zinc-400 text-sm">
              Nessun account?{' '}
              <Link to="/auth/register" className="text-amber-500 hover:underline">Registra il tuo negozio</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
