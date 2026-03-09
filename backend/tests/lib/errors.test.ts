import { describe, it, expect } from 'vitest'
import { AppError } from '../../src/lib/errors'

describe('AppError', () => {
  it('sets code and statusCode', () => {
    const err = new AppError('NOT_FOUND', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('NOT_FOUND')
  })

  it('uses custom message when provided', () => {
    const err = new AppError('VALIDATION_ERROR', 422, 'Invalid input')
    expect(err.message).toBe('Invalid input')
  })
})
