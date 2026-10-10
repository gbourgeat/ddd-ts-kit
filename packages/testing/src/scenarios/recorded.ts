import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** What `when` left behind: the aggregate, the events of the action, what it threw. */
export interface Recorded<A> {
  readonly aggregate: A;
  readonly events: readonly DomainEvent[];
  readonly thrown: { readonly error: unknown } | undefined;
}
