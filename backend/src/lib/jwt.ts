import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

export interface OwnerBarberPayload {
  userId: string
  role: 'owner' | 'barber'
  shopId: string
}

export interface CustomerPayload {
  customerId: string
  shopId: string
}

export type JwtPayload = OwnerBarberPayload | CustomerPayload

export function signToken(payload: OwnerBarberPayload, expiresIn?: string): string
export function signToken(payload: CustomerPayload, expiresIn?: string): string
export function signToken(payload: JwtPayload, expiresIn = '24h'): string {
  return jwt.sign(payload, SECRET, { expiresIn } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload
}
