import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer.js';

/** A class of the edge a context declared (a controller, a guard, a mapper, a serializer), bound under itself. */
export interface EdgeBinding {
  /** `controller`, `guard`, `mapper`, `serializer`: the word of the transport package. */
  readonly part: string;
  readonly target: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}
