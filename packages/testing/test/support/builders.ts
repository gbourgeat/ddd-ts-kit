import { Builder, defineBuilder, sequence, type Buildable, type Defaults } from '../../src/index.js';
import { Order, at, type Customer, type Line } from './order.js';

export const aLine = defineBuilder<Line>({ defaults: { sku: sequence('sku'), quantity: 1 } });

class CustomerBuilder extends Builder<Customer, Customer> {
  protected defaults(): Defaults<Customer> {
    return { id: sequence('customer'), name: 'Grace Hopper' };
  }

  protected construct(props: Customer): Customer {
    return props;
  }

  named(name: string): this {
    return this.with('name', name);
  }
}

export const aCustomer = (): CustomerBuilder => new CustomerBuilder();

/** What a client sends to place an order: the same vocabulary, as an API payload. */
export interface PlaceOrderRequest {
  readonly customerId: string;
  readonly lines: readonly Line[];
}

interface OrderProps {
  readonly id: string;
  readonly customer: Customer;
  readonly lines: readonly Line[];
  readonly paid: boolean;
}

class OrderBuilder extends Builder<OrderProps, Order> {
  protected defaults(): Defaults<OrderProps> {
    return { id: sequence('order'), customer: aCustomer(), lines: [aLine()], paid: false };
  }

  // Through the public API only: a built order went through the same rules as a real one.
  protected construct(props: OrderProps): Order {
    const order = Order.place(props.id, props.customer, props.lines, at);
    if (props.paid) {
      order.pay(at);
    }
    return order;
  }

  buildRequest(): PlaceOrderRequest {
    const { customer, lines } = this.props();
    return { customerId: customer.id, lines };
  }

  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  placedBy(customer: Buildable<Customer>): this {
    return this.with('customer', customer);
  }

  withLine(line: Buildable<Line>): this {
    return this.adding('lines', line);
  }

  withoutLines(): this {
    return this.with('lines', []);
  }

  paid(): this {
    return this.with('paid', true);
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
