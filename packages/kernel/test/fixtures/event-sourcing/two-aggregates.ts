import type { DomainEvent } from '../../../src';
import { On, Projection } from '../../../src/declarations';
import { MoneyDeposited } from '../../support/bank/account';

/** An event of another aggregate than the account. */
export class LoanRepaid implements DomainEvent {
  static readonly eventName = 'bank.loan.repaid';

  readonly name = LoanRepaid.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

/** Follows the events of the account and of another aggregate, whose serializer it is not given. */
@Projection('bank.two-aggregates', { feed: 'event-store' })
export class TwoAggregatesProjection {
  @On(MoneyDeposited)
  async deposited(): Promise<void> {}

  @On(LoanRepaid)
  async repaid(): Promise<void> {}
}
