/**
 * A fact that happened inside one bounded context, named in the past tense.
 * Never leaves the context as is: publish an IntegrationEvent instead.
 */
export interface DomainEvent {
  /** Stable name, `<context>.<aggregate>.<fact>`, e.g. `billing.invoice.issued`. */
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

export { NamedDomainEvent } from './named-domain-event';
