import type { Clock, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import type { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { OrderPlaced } from '../../../published-language/order-placed.js';
import type { PlaceOrder } from './place-order.command.js';

export class PlaceOrderHandler {
  static built = 0;

  constructor(
    private readonly orders: OrderRepository,
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    PlaceOrderHandler.built += 1;
  }

  async execute(command: PlaceOrder): Promise<string> {
    const id = this.ids.next();

    await this.orders.save({ id, sku: command.sku, placedAt: this.clock.now(), cancelled: false });

    await this.publisher.publish([
      {
        id: this.ids.next(),
        type: OrderPlaced.type,
        version: OrderPlaced.version,
        occurredAt: this.clock.now().toISOString(),
        payload: { orderId: id, sku: command.sku },
      },
    ]);

    return id;
  }
}
