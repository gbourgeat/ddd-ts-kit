import {
  Command,
  Query,
  err,
  ok,
  type Clock,
  type CommandBus,
  type IdGenerator,
  type IntegrationEvent,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  EVENT_PUBLISHER,
  ID_GENERATOR,
  defineContextModule,
  token,
  type EventContract,
} from '../../src/index.js';

export interface Order {
  readonly id: string;
  readonly sku: string;
  readonly placedAt: Date;
  cancelled: boolean;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | undefined>;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }
}

export interface OrderPlacedPayload {
  readonly orderId: string;
  readonly sku: string;
}

/** Shaped like a `defineIntegrationEvent` declaration, written by hand to need no schema library. */
export const OrderPlaced: EventContract<OrderPlacedPayload> = {
  type: 'ordering.order.placed',
  version: 1,
  parse(event) {
    if (event.type !== this.type) return err({ reason: 'type-mismatch' });
    if (event.version !== this.version) return err({ reason: 'version-mismatch' });
    const { payload } = event;
    if (!isOrderPlacedPayload(payload)) return err({ reason: 'invalid-payload' });
    return ok({ ...event, payload });
  },
};

function isOrderPlacedPayload(payload: unknown): payload is OrderPlacedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'orderId' in payload &&
    typeof payload.orderId === 'string' &&
    'sku' in payload &&
    typeof payload.sku === 'string'
  );
}

export class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

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

export class CancelOrder extends Command {
  constructor(readonly orderId: string) {
    super();
  }
}

export class CancelOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: CancelOrder): Promise<void> {
    const order = await this.orders.findById(command.orderId);
    if (order !== undefined) await this.orders.save({ ...order, cancelled: true });
  }
}

export class GetOrder extends Query<Order | undefined> {
  constructor(readonly orderId: string) {
    super();
  }
}

export class GetOrderHandler {
  constructor(private readonly orders: OrderRepository) {}

  execute(query: GetOrder): Promise<Order | undefined> {
    return this.orders.findById(query.orderId);
  }
}

export class IssueInvoice extends Command {
  constructor(readonly orderId: string) {
    super();
  }
}

export class InvoiceLedger {
  readonly invoicedOrders: string[] = [];
}

export class IssueInvoiceHandler {
  constructor(private readonly ledger: InvoiceLedger) {}

  async execute(command: IssueInvoice): Promise<void> {
    this.ledger.invoicedOrders.push(command.orderId);
  }
}

export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(event.payload.orderId));
  }
}

export const ORDER_REPOSITORY = token<OrderRepository>('ordering.OrderRepository');
export const INVOICE_LEDGER = token<InvoiceLedger>('billing.InvoiceLedger');

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(ORDER_REPOSITORY).toClass(InMemoryOrderRepository).as('repository');
    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [ORDER_REPOSITORY, EVENT_PUBLISHER, ID_GENERATOR, CLOCK]);
    builder.command(CancelOrder).handledBy(CancelOrderHandler, [ORDER_REPOSITORY]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [ORDER_REPOSITORY]);
  },
});

export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.bind(INVOICE_LEDGER).toClass(InvoiceLedger);
    builder.command(IssueInvoice).handledBy(IssueInvoiceHandler, [INVOICE_LEDGER]);
    builder
      .on(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
      .handledBy(InvoiceOnOrderPlaced, [COMMAND_BUS]);
  },
});

export function orderPlaced(id: string, payload: unknown, version = 1): IntegrationEvent {
  return {
    id,
    type: OrderPlaced.type,
    version,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload,
  };
}
