import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Balances, balanceCriteria, type BalanceRow } from '../../application/ports/balances.port';

@Adapter(Balances)
export class InMemoryBalances extends InMemoryReadModelStore<BalanceRow> implements Balances {
  constructor() {
    super(balanceCriteria);
  }
}
