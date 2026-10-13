import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class PracticeOpened implements DomainEvent {
  static readonly eventName = 'identity.practice.opened';

  readonly name = PracticeOpened.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly name: string; readonly timeZone: string; readonly managerId: string },
  ) {}
}
