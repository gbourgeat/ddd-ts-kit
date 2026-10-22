import type { DomainEventDispatcher, DomainEventPhase } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer';
import type { Resolve } from './resolve';

/** A handler of a domain event of its own context, attached to the dispatcher of the application. */
export interface DomainEventHandling {
  /** The name the events carry. */
  readonly name: string;
  /** When the handler runs relative to the commit of the unit of work. */
  readonly phase: DomainEventPhase;
  /** Name of the class the handler is typed by: an event of another class is not handed to it. */
  readonly event: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  /** Name of the projection the method belongs to, when it is not a declared handler. */
  readonly projection?: string;
  readonly attach: (resolve: Resolve, dispatcher: DomainEventDispatcher) => void;
}
