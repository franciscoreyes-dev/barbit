import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/auth', () => ({
  registerOwner: vi.fn(),
  login: vi.fn(),
}))

vi.mock('../../src/services/otp', () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

import { registerOwner, login } from '../../src/services/auth'
import { sendOtp, verifyOtp } from '../../src/services/otp'
import { buildTestApp } from '../helpers/app'
import { AppError } from '../../src/lib/errors'

const app = buildTestApp()

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with token on success', async () => {
    vi.mocked(registerOwner).mockResolvedValue({ token: 'jwt-token' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'owner@test.com',
        password: 'password123',
        shopName: 'Test Shop',
        shopCity: 'Roma',
        ownerName: 'Mario Rossi',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ token: 'jwt-token' })
  })

  it('returns 409 when EMAIL_TAKEN', async () => {
    vi.mocked(registerOwner).mockRejectedValue(new AppError('EMAIL_TAKEN', 409))

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'taken@test.com',
        password: 'password123',
        shopName: 'Shop',
        shopCity: 'Roma',
        ownerName: 'Mario',
      },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('returns 422 on missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'owner@test.com' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 409 when SLUG_TAKEN', async () => {
    vi.mocked(registerOwner).mockRejectedValue(new AppError('SLUG_TAKEN', 409))

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'new@test.com',
        password: 'password123',
        shopName: 'Taken Shop',
        shopCity: 'Roma',
        ownerName: 'Mario',
      },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SLUG_TAKEN' })
  })
})

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with token on success', async () => {
    vi.mocked(login).mockResolvedValue({ token: 'jwt-token' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'owner@test.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ token: 'jwt-token' })
  })

  it('returns 401 on INVALID_CREDENTIALS', async () => {
    vi.mocked(login).mockRejectedValue(new AppError('INVALID_CREDENTIALS', 401))

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'owner@test.com', password: 'wrong' },
    })

    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('returns 422 on missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'owner@test.com' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 403 when ACCOUNT_INACTIVE', async () => {
    vi.mocked(login).mockRejectedValue(new AppError('ACCOUNT_INACTIVE', 403))

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'barber@test.com', password: 'pass' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'ACCOUNT_INACTIVE' })
  })
})

describe('POST /auth/otp/send', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(sendOtp).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/send',
      payload: { phone: '+393331234567', shopId: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ ok: true })
    expect(sendOtp).toHaveBeenCalledWith('+393331234567')
  })

  it('returns 422 on missing phone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/send',
      payload: { shopId: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 on invalid shopId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/send',
      payload: { phone: '+393331234567', shopId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('POST /auth/otp/verify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with token on success', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ token: 'customer-jwt' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: {
        phone: '+393331234567',
        code: '123456',
        shopId: '00000000-0000-0000-0000-000000000001',
      },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ token: 'customer-jwt' })
  })

  it('returns 400 on OTP_INVALID', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new AppError('OTP_INVALID', 400))

    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: {
        phone: '+393331234567',
        code: '000000',
        shopId: '00000000-0000-0000-0000-000000000001',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'OTP_INVALID' })
  })

  it('returns 422 on code not exactly 6 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: {
        phone: '+393331234567',
        code: '12345',
        shopId: '00000000-0000-0000-0000-000000000001',
      },
    })
    expect(res.statusCode).toBe(422)
  })
})
