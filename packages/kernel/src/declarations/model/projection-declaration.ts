import type { Token } from '../token/token';
import type { ProjectionApplication } from './projection-application';
import type { ProjectionFeed } from './projection-feed';

export interface ProjectionDeclaration {
  readonly role: 'projection';
  /** `<context>.<name>`: the consumer the projection is subscribed as, its idempotency scope and its label. */
  readonly name: string;
  readonly implementation: new (...args: never) => object;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
  /** Where its domain events come from: `dispatch` unless `@Projection` says `{ feed: 'event-store' }`. */
  readonly feed: ProjectionFeed;
  /** In the order the methods are written. */
  readonly applies: readonly ProjectionApplication[];
}
