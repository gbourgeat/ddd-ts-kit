import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

export class {{event.pascal}} extends NamedDomainEvent('{{event.name}}') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    // TODO(domain): add as readonly parameters the facts a reaction needs to know about "{{event.words}}" (value objects or primitives, never the aggregate itself).
  ) {
    super();
  }
}
