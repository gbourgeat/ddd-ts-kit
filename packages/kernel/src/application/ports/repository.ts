import type { AggregateRoot } from '../../domain/aggregate-root.js';

/**
 * The contract every repository shares, one per aggregate root. The port of a context extends
 * it and adds its own finders: `export abstract class OrderRepository extends Repository<Order> {}`.
 * The adapter of infrastructure implements that port.
 */
export abstract class Repository<A extends AggregateRoot<Id>, Id extends string | number = string> {
  abstract findById(id: Id): Promise<A | undefined>;

  abstract save(aggregate: A): Promise<void>;
}
