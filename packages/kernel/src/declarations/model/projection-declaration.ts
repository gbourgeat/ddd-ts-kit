import type { Token } from '../token/token.js';
import type { ProjectionApplication } from './projection-application.js';

export interface ProjectionDeclaration {
  readonly role: 'projection';
  /** `<context>.<name>`: the consumer the projection is subscribed as, its idempotency scope and its label. */
  readonly name: string;
  readonly implementation: new (...args: never) => object;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
  /** In the order the methods are written. */
  readonly applies: readonly ProjectionApplication[];
}
