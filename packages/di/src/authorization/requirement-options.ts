import type { ResourcePointer } from '@ddd-ts-kit/kernel/declarations';

export interface RequirementOptions<M> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourcePointer;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => Readonly<Record<string, unknown>>;
}
