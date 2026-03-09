import twilio from 'twilio'
import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { signToken } from '../lib/jwt'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export async function sendOtp(phone: string, _shopId: string): Promise<void> {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  )

  const client = getTwilioClient()
  await client.messages.create({
    body: `Il tuo codice Barbit: ${code}`,
    from: process.env.TWILIO_FROM_NUMBER,
    to: phone,
  })
}

export async function verifyOtp(phone: string, code: string, shopId: string) {
  const res = await db.query(
    `SELECT id, code, expires_at FROM otp_codes
     WHERE phone = $1 AND code = $2 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  )

  const otp = res.rows[0]
  if (!otp) throw new AppError('OTP_INVALID', 400)
  if (new Date(otp.expires_at) < new Date()) throw new AppError('OTP_EXPIRED', 400)

  await db.query(`UPDATE otp_codes SET used_at = now() WHERE id = $1`, [otp.id])

  const customerRes = await db.query(
    `INSERT INTO customers (phone, shop_id) VALUES ($1, $2)
     ON CONFLICT (phone, shop_id) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone, shop_id`,
    [phone, shopId]
  )
  const customer = customerRes.rows[0]

  const token = signToken({ customerId: customer.id, shopId: customer.shop_id }, '7d')
  return { token }
}
