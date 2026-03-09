import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../src/lib/jwt'

describe('jwt helpers', () => {
  it('signs and verifies owner token', () => {
    const payload = { userId: 'u1', role: 'owner' as const, shopId: 's1' }
    const token = signToken(payload)
    const decoded = verifyToken(token)
    expect(decoded).toMatchObject(payload)
  })

  it('signs and verifies customer token', () => {
    const payload = { customerId: 'c1', shopId: 's1' }
    const token = signToken(payload, '7d')
    const decoded = verifyToken(token)
    expect(decoded).toMatchObject(payload)
  })

  it('throws on invalid token', () => {
    expect(() => verifyToken('invalid')).toThrow()
  })
})
