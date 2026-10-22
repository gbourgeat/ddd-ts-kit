import type { Order } from '../../../domain/order';
import type { OrderRepository } from '../../../domain/repositories/order.repository';
import type { GetOrder } from './get-order.query';

export class GetOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  execute(query: GetOrder): Promise<Order | undefined> {
    return this.orders.findById(query.orderId);
  }
}
