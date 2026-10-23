import type { OrderRepository } from '../../../domain/repositories/order.repository';
import type { CancelOrder } from './cancel-order.command';

export class CancelOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: CancelOrder): Promise<void> {
    const order = await this.orders.findById(command.orderId);

    if (order !== undefined) {
      await this.orders.save({ ...order, cancelled: true });
    }
  }
}
