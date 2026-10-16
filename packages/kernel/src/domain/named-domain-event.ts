/**
 * The base class of a domain event, which gives it its name once:
 * `class InvoiceIssued extends NamedDomainEvent('billing.invoice.issued')`. The class carries it as
 * `InvoiceIssued.eventName`, what handlers and projections are attached under, and every event as
 * `name`, both typed with the literal. The event itself brings its `aggregateId` and `occurredAt`.
 */
export function NamedDomainEvent<const Name extends string>(eventName: Name) {
  abstract class Named {
    static readonly eventName: Name = eventName;

    readonly name: Name = eventName;
  }

  return Named;
}
