import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class {{event.pascal}} implements DomainEvent {
  readonly name = '{{event.name}}';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    // TODO(domain): add as readonly parameters the facts a reaction needs to know about "{{event.words}}" (value objects or primitives, never the aggregate itself).
  ) {}
}
