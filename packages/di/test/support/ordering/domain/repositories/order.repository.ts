import type { Order } from '../order';

export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;

  abstract findById(id: string): Promise<Order | undefined>;
}
