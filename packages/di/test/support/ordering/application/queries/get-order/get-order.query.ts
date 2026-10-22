import { Query } from '@ddd-ts-kit/kernel';
import type { Order } from '../../../domain/order';

export class GetOrder extends Query<Order | undefined> {
  constructor(readonly orderId: string) {
    super();
  }
}
