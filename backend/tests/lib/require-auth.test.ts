import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { signToken, CustomerPayload } from '../../src/lib/jwt'
import { requireAuth, requireOwner } from '../../src/lib/require-auth'
import { requireCustomer } from '../../src/lib/require-customer'

function buildApp() {
  const app = Fastify({ logger: false })

  app.get('/protected', { preHandler: requireAuth }, async (req) => ({
    userId: req.user?.userId,
  }))

  app.get('/owner-only', { preHandler: requireOwner }, async (req) => ({
    role: req.user?.role,
  }))

  app.get('/customer-only', { preHandler: requireCustomer }, async (req) => ({
    customerId: req.customer?.customerId,
  }))

  return app
}

const app = buildApp()

describe('requireAuth', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns 401 on invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('allows access with valid owner token', async () => {
    const token = signToken({ userId: 'u1', role: 'owner', shopId: 's1' })
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ userId: 'u1' })
  })
})

describe('requireOwner', () => {
  it('returns 401 when no token (only one reply sent)', async () => {
    const res = await app.inject({ method: 'GET', url: '/owner-only' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when role is barber', async () => {
    const token = signToken({ userId: 'u2', role: 'barber', shopId: 's1' })
    const res = await app.inject({
      method: 'GET',
      url: '/owner-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('allows owner access', async () => {
    const token = signToken({ userId: 'u1', role: 'owner', shopId: 's1' })
    const res = await app.inject({
      method: 'GET',
      url: '/owner-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('requireCustomer', () => {
  it('returns 401 when no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/customer-only' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when owner token is used (not customer)', async () => {
    const token = signToken({ userId: 'u1', role: 'owner', shopId: 's1' })
    const res = await app.inject({
      method: 'GET',
      url: '/customer-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('allows access with valid customer token', async () => {
    const token = signToken({ customerId: 'c1', shopId: 's1' } as CustomerPayload, '7d')
    const res = await app.inject({
      method: 'GET',
      url: '/customer-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ customerId: 'c1' })
  })
})
