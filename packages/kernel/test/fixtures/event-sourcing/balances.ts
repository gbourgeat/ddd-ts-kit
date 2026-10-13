import { ReadModelStore, defineCriteria, stampOf, storedStampOf, type ReadModelWrite } from '../../../src/index.js';
import { On, Projection } from '../../../src/declarations.js';
import { MoneyDeposited, MoneyWithdrawn } from '../../support/bank/account.js';

export interface BalanceRow {
  readonly accountId: string;
  readonly cents: number;
}

export const balanceCriteria = defineCriteria<BalanceRow>({
  fields: { accountId: { type: 'string', filter: ['eq'] }, cents: { type: 'number', sortable: true } },
  defaultSort: [{ field: 'cents', direction: 'desc' }],
  tieBreaker: 'accountId',
});

export abstract class Balances extends ReadModelStore<BalanceRow> {}

/** Fed by the event store: each row is stamped with the version of its stream. */
@Projection('bank.balances', { feed: 'event-store' })
export class BalancesProjection {
  /** How many times the projection applied an event, a stale one included. */
  applied = 0;

  constructor(private readonly balances: ReadModelStore<BalanceRow>) {}

  @On(MoneyDeposited, { name: 'bank.account.deposited' })
  async deposited(event: MoneyDeposited): Promise<ReadModelWrite> {
    return this.moved(event, event.cents);
  }

  @On(MoneyWithdrawn, { name: 'bank.account.withdrawn' })
  async withdrawn(event: MoneyWithdrawn): Promise<ReadModelWrite> {
    return this.moved(event, -event.cents);
  }

  private moved(event: MoneyDeposited | MoneyWithdrawn, cents: number): Promise<ReadModelWrite> {
    this.applied += 1;

    return this.balances.upsertIfNewer(event.aggregateId, storedStampOf(event) ?? stampOf(event), (row) => ({
      accountId: event.aggregateId,
      cents: (row?.cents ?? 0) + cents,
    }));
  }
}
