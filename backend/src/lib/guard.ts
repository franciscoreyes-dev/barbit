import { AppError } from './errors'
import { OwnerBarberPayload } from './jwt'

export function authorizeBarberAccess(
  barber: { user_id: string; shop_id: string },
  user: OwnerBarberPayload
): void {
  if (user.role === 'owner') {
    if (barber.shop_id !== user.shopId) throw new AppError('FORBIDDEN', 403)
  } else {
    if (barber.user_id !== user.userId) throw new AppError('FORBIDDEN', 403)
  }
}
