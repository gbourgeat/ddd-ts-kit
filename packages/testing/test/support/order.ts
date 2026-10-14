import { AggregateRoot, DomainError, type DomainEvent } from '@ddd-ts-kit/kernel';

export class OrderAlreadyPaid extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
}

export class EmptyOrder extends DomainError {
  readonly code = 'EMPTY_ORDER';
}

export interface Customer {
  readonly id: string;
  readonly name: string;
}

export interface Line {
  readonly sku: string;
  readonly quantity: number;
}

export class OrderPaid implements DomainEvent {
  static readonly eventName = 'ordering.order.paid';

  readonly name = OrderPaid.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly amount: number,
  ) {}
}

export interface OrderSnapshot {
  readonly id: string;
  readonly customer: Customer;
  readonly lines: Line[];
  readonly status: 'placed' | 'paid';
}

export class Order extends AggregateRoot {
  private readonly customer: Customer;

  private readonly lines: Line[];

  private paymentStatus: 'placed' | 'paid';

  private constructor(snapshot: OrderSnapshot) {
    super(snapshot.id);
    this.customer = snapshot.customer;
    this.lines = [...snapshot.lines];
    this.paymentStatus = snapshot.status;
  }

  static place(id: string, customer: Customer, lines: readonly Line[], at: Date): Order {
    if (lines.length === 0) {
      throw new EmptyOrder('An order needs at least one line');
    }

    const order = new Order({ id, customer, lines: [...lines], status: 'placed' });

    order.record({ name: 'ordering.order.placed', aggregateId: id, occurredAt: at });

    return order;
  }

  static rehydrate(snapshot: OrderSnapshot): Order {
    return new Order(snapshot);
  }

  pay(at: Date): void {
    if (this.paymentStatus === 'paid') {
      throw new OrderAlreadyPaid(`Order ${this.id} is already paid`);
    }

    this.paymentStatus = 'paid';
    this.record(new OrderPaid(this.id, at, this.total));
  }

  addLine(line: Line, at: Date): void {
    if (this.paymentStatus === 'paid') {
      throw new OrderAlreadyPaid(`Order ${this.id} is already paid`);
    }

    this.lines.push(line);
    this.record({ name: 'ordering.order.line-added', aggregateId: this.id, occurredAt: at });
  }

  get status(): 'placed' | 'paid' {
    return this.paymentStatus;
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity * 10, 0);
  }

  toSnapshot(): OrderSnapshot {
    return { id: this.id, customer: this.customer, lines: [...this.lines], status: this.status };
  }
}

export const at = new Date('2026-03-01T10:00:00.000Z');
