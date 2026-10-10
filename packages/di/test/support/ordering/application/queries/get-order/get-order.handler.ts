import type { Order } from '../../../domain/order.js';
import type { OrderRepository } from '../../../domain/repositories/order.repository.js';
import type { GetOrder } from './get-order.query.js';

export class GetOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  execute(query: GetOrder): Promise<Order | undefined> {
    return this.orders.findById(query.orderId);
  }
}
