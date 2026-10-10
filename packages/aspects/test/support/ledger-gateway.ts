/**
 * A fake adapter written as the kit writes its classes: its state is in `private` fields, held
 * in objects so that a frozen instance can still change it, and its public methods go through
 * a `private` asynchronous method and through each other with `this`.
 */
export class LedgerGateway {
  private readonly entries = new Map<string, number>();

  private readonly failures: unknown[] = [];

  private readonly sent: string[] = [];

  private readonly attempted: string[] = [];

  get posted(): number {
    return this.sent.length;
  }

  /** How many times the private step ran, failures included. */
  get sendAttempts(): number {
    return this.attempted.length;
  }

  failNext(...failures: unknown[]): this {
    this.failures.push(...failures);

    return this;
  }

  async post(account: string, amount: number): Promise<void> {
    await this.send(account);
    this.entries.set(account, (this.entries.get(account) ?? 0) + amount);
  }

  async postAll(postings: readonly (readonly [account: string, amount: number])[]): Promise<void> {
    for (const [account, amount] of postings) await this.post(account, amount);
  }

  async balance(): Promise<number> {
    return [...this.entries.values()].reduce((total, amount) => total + amount, 0);
  }

  private async send(account: string): Promise<void> {
    this.attempted.push(account);
    const failure = this.failures.shift();

    if (failure !== undefined) throw failure;

    this.sent.push(account);
  }
}
