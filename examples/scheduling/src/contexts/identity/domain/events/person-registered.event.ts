import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class PersonRegistered implements DomainEvent {
  static readonly eventName = 'identity.person.registered';

  readonly name = PersonRegistered.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly displayName: string; readonly email: string },
  ) {}
}
