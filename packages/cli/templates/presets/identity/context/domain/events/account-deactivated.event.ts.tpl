import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** An account was deactivated: its person signs in no more. */
export class AccountDeactivated implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.account.deactivated';

  readonly name = AccountDeactivated.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
