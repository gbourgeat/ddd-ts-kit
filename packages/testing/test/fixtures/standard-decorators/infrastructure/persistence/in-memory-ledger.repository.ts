import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { Ledger } from '../../domain/repositories/ledger.repository.js';

@Repository(Ledger)
export class InMemoryLedger implements Ledger {
  private readonly amounts: number[] = [];

  record(amount: number): void {
    if (!Number.isFinite(amount)) {
      throw new RangeError('An amount is a finite number');
    }

    this.amounts.push(amount);
  }

  total(): number {
    return this.amounts.reduce((sum, amount) => sum + amount, 0);
  }
}
