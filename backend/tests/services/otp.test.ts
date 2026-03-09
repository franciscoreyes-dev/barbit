import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({
  db: { query: vi.fn() },
}))

vi.mock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    messages: {
      create: vi.fn().mockResolvedValue({ sid: 'SM123' }),
    },
  }),
}))

import { db } from '../../src/db/pool'
import { sendOtp, verifyOtp } from '../../src/services/otp'

describe('sendOtp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts OTP into db and calls Twilio', async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any)

    await sendOtp('+393331234567', 'shop-1')

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO otp_codes'),
      expect.arrayContaining(['+393331234567'])
    )
  })
})

describe('verifyOtp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks OTP used and creates/returns customer JWT', async () => {
    const otpRow = { id: 'otp-1', code: '123456', expires_at: new Date(Date.now() + 60000) }
    const customerRow = { id: 'customer-1', phone: '+393331234567', shop_id: 'shop-1' }

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [otpRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [customerRow], rowCount: 1 } as any)

    const result = await verifyOtp('+393331234567', '123456', 'shop-1')
    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
  })

  it('throws OTP_INVALID if code not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(verifyOtp('+393331234567', '000000', 'shop-1')).rejects.toThrow('OTP_INVALID')
  })

  it('throws OTP_EXPIRED if expires_at is in the past', async () => {
    const expired = { id: 'otp-1', code: '123456', expires_at: new Date(Date.now() - 1000) }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [expired], rowCount: 1 } as any)
    await expect(verifyOtp('+393331234567', '123456', 'shop-1')).rejects.toThrow('OTP_EXPIRED')
  })

  it('marks OTP as used (updates used_at)', async () => {
    const otpRow = { id: 'otp-1', code: '123456', expires_at: new Date(Date.now() + 60000) }
    const customerRow = { id: 'customer-1', phone: '+393331234567', shop_id: 'shop-1' }

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [otpRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [customerRow], rowCount: 1 } as any)

    await verifyOtp('+393331234567', '123456', 'shop-1')

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE otp_codes SET used_at'),
      expect.arrayContaining(['otp-1'])
    )
  })
})
