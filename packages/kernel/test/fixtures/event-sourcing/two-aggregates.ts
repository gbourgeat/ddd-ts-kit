import { On, Projection } from '../../../src/declarations.js';
import { MoneyDeposited } from '../../support/bank/account.js';

/** Follows the events of the account and of another aggregate, whose serializer it is not given. */
@Projection('bank.two-aggregates', { feed: 'event-store' })
export class TwoAggregatesProjection {
  @On(MoneyDeposited, { name: 'bank.account.deposited' })
  async deposited(): Promise<void> {}

  @On(MoneyDeposited, { name: 'bank.loan.repaid' })
  async repaid(): Promise<void> {}
}
