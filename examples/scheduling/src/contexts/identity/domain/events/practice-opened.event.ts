import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class PracticeOpened implements DomainEvent {
  readonly name = 'identity.practice.opened';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly name: string; readonly timeZone: string; readonly managerId: string },
  ) {}
}
