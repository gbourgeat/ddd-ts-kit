import type { HandlerDependency } from './handler-dependency';

/** A production class of a context that handles a domain event, with the phase it runs in. */
export interface EventHandler {
  readonly name: string;
  readonly line: number;
  readonly context: string;
  readonly isAfterCommit: boolean;
  readonly dependencies: readonly HandlerDependency[];
}
