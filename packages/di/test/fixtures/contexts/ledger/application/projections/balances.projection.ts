import { stampOf, storedStampOf, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { MoneyMoved } from '../../domain/events/money-moved.event.js';
import { Balances } from '../ports/balances.port.js';

@Projection('ledger.balances', { feed: 'event-store' }, [Balances])
export class BalancesProjection {
  constructor(private readonly balances: Balances) {}

  @On(MoneyMoved)
  async moved(event: MoneyMoved): Promise<ReadModelWrite> {
    return this.balances.upsertIfNewer(event.aggregateId, storedStampOf(event) ?? stampOf(event), (row) => ({
      accountId: event.aggregateId,
      cents: (row?.cents ?? 0) + event.cents,
    }));
  }
}
