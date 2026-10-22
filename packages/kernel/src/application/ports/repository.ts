import type { AggregateRoot } from '../../domain/aggregate-root';

/**
 * The contract every repository shares, one per aggregate root. The port of a context extends
 * it and adds its own finders: `export abstract class OrderRepository extends Repository<Order> {}`.
 * The adapter of infrastructure implements that port, and only persists: the domain events the
 * aggregate recorded are dispatched from outside, once a method that was handed the aggregate
 * (`save`, or a `saveAll`, a `remove` of the port) has resolved.
 */
export abstract class Repository<A extends AggregateRoot<Id>, Id extends string | number = string> {
  abstract findById(id: Id): Promise<A | undefined>;

  abstract save(aggregate: A): Promise<void>;
}
