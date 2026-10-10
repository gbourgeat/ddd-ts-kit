import { DomainError } from '@ddd-ts-kit/kernel';

export class OrderAlreadyPaid extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';

  constructor(orderId: string, options?: { cause?: unknown }) {
    super(`Order ${orderId} is already paid`, options);
  }
}
