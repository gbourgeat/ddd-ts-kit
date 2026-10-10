import { InsufficientFunds } from './insufficient-funds.js';

export class AccountRepository {
  private readonly rows = new Map<string, number>([['acc-1', 100]]);

  initialised = false;

  get size(): number {
    return this.rows.size;
  }

  async findBalance(id: string): Promise<number | undefined> {
    return this.read(id);
  }

  async debit(id: string, amount: number): Promise<void> {
    if ((this.read(id) ?? 0) < amount) {
      throw new InsufficientFunds(`account ${id} lacks ${amount}`);
    }
  }

  async crash(): Promise<void> {
    throw new TypeError('connection to db.internal:5432 refused for user admin');
  }

  async rejectWithDriverCode(): Promise<void> {
    throw Object.assign(new Error('boom'), { code: 'ECONNREFUSED' });
  }

  async rejectWithUnsafeCode(): Promise<void> {
    throw Object.assign(new Error('boom'), { code: 'not an identifier' });
  }

  tableName(): string {
    return 'accounts';
  }

  // Not declared async: only its return value reveals that it is.
  lazyCount(): Promise<number> {
    return Promise.resolve(this.rows.size);
  }

  *ids(): Generator<string> {
    yield* this.rows.keys();
  }

  async *stream(): AsyncGenerator<string> {
    yield* this.rows.keys();
  }

  async onModuleInit(): Promise<void> {
    this.initialised = true;
  }

  async warmUp(): Promise<void> {}

  async [Symbol.asyncDispose](): Promise<void> {}

  private read(id: string): number | undefined {
    return this.rows.get(id);
  }
}
