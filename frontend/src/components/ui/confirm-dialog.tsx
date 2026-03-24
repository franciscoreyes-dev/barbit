import { useEffect, useRef, useCallback } from 'react'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = 'Conferma', variant = 'default' }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      cancelRef.current?.focus()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  const handleCancel = useCallback(() => { onCancel() }, [onCancel])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    el.addEventListener('close', handleCancel)
    return () => el.removeEventListener('close', handleCancel)
  }, [handleCancel])

  return (
    <dialog
      ref={dialogRef}
      className="m-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/50 max-w-sm w-full fixed inset-0"
      aria-labelledby="confirm-title"
      aria-describedby={description ? 'confirm-desc' : undefined}
    >
      <h2 id="confirm-title" className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
      {description && <p id="confirm-desc" className="text-slate-500 text-sm mb-4">{description}</p>}
      <div className="flex gap-2 justify-end">
        <button ref={cancelRef} onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all duration-150 min-h-[44px]">
          Annulla
        </button>
        <Button variant={variant} onClick={onConfirm} className="min-h-[44px]">{confirmLabel}</Button>
      </div>
    </dialog>
  )
}
