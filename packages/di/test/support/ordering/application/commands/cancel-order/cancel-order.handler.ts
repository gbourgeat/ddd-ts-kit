import type { OrderRepository } from '../../../domain/repositories/order.repository.js';
import type { CancelOrder } from './cancel-order.command.js';

export class CancelOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: CancelOrder): Promise<void> {
    const order = await this.orders.findById(command.orderId);

    if (order !== undefined) await this.orders.save({ ...order, cancelled: true });
  }
}
