import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class MoneyMoved implements DomainEvent {
  readonly name = 'ledger.account.money-moved';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly cents: number,
  ) {}
}
