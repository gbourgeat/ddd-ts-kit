import type { Order } from '../../domain/order.js';
import type { OrderRepository } from '../../domain/repositories/order.repository.js';

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }
}
