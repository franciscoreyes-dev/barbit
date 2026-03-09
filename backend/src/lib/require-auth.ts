import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken, OwnerBarberPayload } from './jwt'

declare module 'fastify' {
  interface FastifyRequest {
    user?: OwnerBarberPayload
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ code: 'UNAUTHORIZED' })
    return
  }
  try {
    const token = auth.slice(7)
    const payload = verifyToken(token)
    if (!('userId' in payload)) {
      reply.code(401).send({ code: 'UNAUTHORIZED' })
      return
    }
    request.user = payload as OwnerBarberPayload
  } catch {
    reply.code(401).send({ code: 'UNAUTHORIZED' })
  }
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (request.user?.role !== 'owner') {
    reply.code(403).send({ code: 'FORBIDDEN' })
  }
}
