export abstract class Ledger {
  abstract record(amount: number): void;

  abstract total(): number;
}
