import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class PersonRegistered implements DomainEvent {
  readonly name = 'identity.person.registered';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly displayName: string; readonly email: string },
  ) {}
}
