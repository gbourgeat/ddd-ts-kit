import type { DomainEvent } from '../domain-event.js';

/**
 * The apply method of each event an event-sourced aggregate records, by the name the event
 * carries: `{ 'billing.invoice.issued': (event) => this.applyIssued(event) }`. Every name of the
 * union is asked for, so an event without its apply method does not compile.
 */
export type Appliers<E extends DomainEvent> = {
  readonly [Name in E['name']]: (event: Extract<E, { readonly name: Name }>) => void;
};
