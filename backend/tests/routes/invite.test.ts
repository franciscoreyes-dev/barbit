import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/invite', () => ({
  sendInvite: vi.fn(),
  getInviteInfo: vi.fn(),
  acceptInvite: vi.fn(),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
  requireOwner: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import { sendInvite, getInviteInfo, acceptInvite } from '../../src/services/invite'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { inviteRoutes } from '../../src/routes/invite'

function buildInviteTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code })
    } else {
      reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
    }
  })
  app.register(inviteRoutes)
  return app
}

const app = buildInviteTestApp()

describe('GET /invite/:token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with invite info', async () => {
    vi.mocked(getInviteInfo).mockResolvedValue({ email: 'barber@test.com', shopName: 'Test Shop' })

    const res = await app.inject({ method: 'GET', url: '/invite/valid-token' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ email: 'barber@test.com', shopName: 'Test Shop' })
  })

  it('returns 404 when INVITE_INVALID', async () => {
    vi.mocked(getInviteInfo).mockRejectedValue(new AppError('INVITE_INVALID', 404))

    const res = await app.inject({ method: 'GET', url: '/invite/bad-token' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'INVITE_INVALID' })
  })

  it('returns 410 when INVITE_EXPIRED', async () => {
    vi.mocked(getInviteInfo).mockRejectedValue(new AppError('INVITE_EXPIRED', 410))

    const res = await app.inject({ method: 'GET', url: '/invite/expired-token' })
    expect(res.statusCode).toBe(410)
  })

  it('returns 409 when INVITE_USED', async () => {
    vi.mocked(getInviteInfo).mockRejectedValue(new AppError('INVITE_USED', 409))

    const res = await app.inject({ method: 'GET', url: '/invite/used-token' })
    expect(res.statusCode).toBe(409)
  })
})

describe('POST /invite/:token/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with token on success', async () => {
    vi.mocked(acceptInvite).mockResolvedValue({ token: 'barber-jwt' })

    const res = await app.inject({
      method: 'POST',
      url: '/invite/valid-token/accept',
      payload: { name: 'Mario Rossi', password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ token: 'barber-jwt' })
  })

  it('returns 422 on missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/invite/valid-token/accept',
      payload: { password: 'password123' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 on short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/invite/valid-token/accept',
      payload: { name: 'Mario', password: 'short' },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('POST /barbers/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 when owner sends invite', async () => {
    vi.mocked(sendInvite).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/invite',
      payload: { email: 'newbarber@test.com' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ ok: true })
    expect(sendInvite).toHaveBeenCalledWith('newbarber@test.com', 'shop-1')
  })

  it('returns 422 on invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/invite',
      payload: { email: 'not-an-email' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(422)
  })
})
