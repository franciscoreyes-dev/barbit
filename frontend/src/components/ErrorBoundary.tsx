import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center" role="alert">
          <p className="text-slate-900 font-semibold mb-2">Qualcosa è andato storto</p>
          <p className="text-slate-500 text-sm mb-4">
            {this.state.error?.message || 'Errore imprevisto nel caricamento.'}
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Riprova
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
