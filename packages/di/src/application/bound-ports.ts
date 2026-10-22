import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Resolve } from '../wiring/resolve';

/** What a part of the application reads of its container: what is bound, and each bound port. */
export interface BoundPorts {
  readonly resolve: Resolve;

  isBound(target: Token<unknown>): boolean;
}
