import { Repository, token } from '@ddd-ts-kit/kernel/declarations';

export interface Ledger {
  record(amount: number): void;
  total(): number;
}

export const LEDGER = token<Ledger>('accounting.Ledger');

@Repository(LEDGER)
export class InMemoryLedger implements Ledger {
  readonly #amounts: number[] = [];

  record(amount: number): void {
    if (!Number.isFinite(amount)) throw new RangeError('An amount is a finite number');
    this.#amounts.push(amount);
  }

  total(): number {
    return this.#amounts.reduce((sum, amount) => sum + amount, 0);
  }
}
