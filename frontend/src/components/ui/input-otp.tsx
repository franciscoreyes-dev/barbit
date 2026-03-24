import { useRef, useCallback, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from 'react'

interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  length?: number
}

export function InputOTP({ value, onChange, length = 6 }: InputOTPProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const focusInput = useCallback((index: number) => {
    inputs.current[index]?.focus()
  }, [])

  const handleChange = useCallback((index: number, e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const chars = value.split('')
    chars[index] = digit
    const next = chars.join('').slice(0, length)
    onChange(next)
    if (digit && index < length - 1) focusInput(index + 1)
  }, [value, length, onChange, focusInput])

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        e.preventDefault()
        const chars = value.split('')
        chars[index - 1] = ''
        onChange(chars.join(''))
        focusInput(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    }
  }, [value, length, onChange, focusInput])

  const handlePaste = useCallback((index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length - index)
    if (pasted) {
      const chars = value.split('')
      for (let j = 0; j < pasted.length; j++) {
        chars[index + j] = pasted[j]
      }
      onChange(chars.join('').slice(0, length))
      focusInput(Math.min(index + pasted.length, length - 1))
    }
  }, [value, length, onChange, focusInput])

  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length }, (_, i) => (
        <span key={i} className="contents">
          {i === Math.floor(length / 2) && (
            <span className="w-3 h-px bg-slate-300 mx-1" aria-hidden="true" />
          )}
          <input
            ref={el => { inputs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ''}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={e => handlePaste(i, e)}
            onFocus={e => e.target.select()}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digito ${i + 1} di ${length}`}
            className="w-12 h-14 text-center text-2xl font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-150"
          />
        </span>
      ))}
    </div>
  )
}
