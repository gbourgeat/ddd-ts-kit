import type { Order } from '../order.js';

export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;

  abstract findById(id: string): Promise<Order | undefined>;
}
