import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const acceptSchema = z.object({
  name: z.string().min(2, 'Nome obbligatorio'),
  password: z.string().min(8, 'Minimo 8 caratteri'),
})

type AcceptForm = z.infer<typeof acceptSchema>

export default function InviteView() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { login } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () =>
      api.get<{ email: string; shopName: string }>(`/invite/${token}`).then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
  })

  const mutation = useMutation({
    mutationFn: (form: AcceptForm) =>
      api.post<{ token: string }>(`/invite/${token}/accept`, form).then(r => r.data),
    onSuccess: ({ token: jwt }) => {
      login(jwt)
      navigate('/barber/calendar')
    },
  })

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Caricamento...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600">Invito non valido o scaduto.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accetta invito</CardTitle>
          <p className="text-slate-500 text-sm mt-1">
            Sei stato invitato a {data?.shopName} come barbiere.
          </p>
          <p className="text-slate-400 text-xs">{data?.email}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Il tuo nome</Label>
              <Input id="name" placeholder="Mario Rossi" {...register('name')} />
              {errors.name && <p className="text-red-600 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Scegli una password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-600 text-xs">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Attivazione...' : 'Attiva account'}
            </Button>
            {mutation.error && (
              <p className="text-red-600 text-sm animate-fade-in" role="alert">Errore durante l'attivazione. Riprova.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
