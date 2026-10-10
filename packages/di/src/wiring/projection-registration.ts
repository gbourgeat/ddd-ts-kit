import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer.js';

/** One event a projection applies, by which method. */
interface AppliedEvent {
  readonly kind: 'integration' | 'domain';
  /** The type of the integration event, or the name the domain events carry. */
  readonly event: string;
  /** Of an integration event. */
  readonly version?: number;
  readonly method: string;
}

/** A projection a context declared: the consumer its events are subscribed as. */
export interface ProjectionRegistration {
  /** `<context>.<name>`, unique in the application. */
  readonly name: string;
  readonly projection: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  readonly applies: readonly AppliedEvent[];
}
