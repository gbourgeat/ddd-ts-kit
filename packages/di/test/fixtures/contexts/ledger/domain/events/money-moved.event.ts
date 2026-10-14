import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class MoneyMoved implements DomainEvent {
  static readonly eventName = 'ledger.account.money-moved';

  readonly name = MoneyMoved.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly cents: number,
  ) {}
}
