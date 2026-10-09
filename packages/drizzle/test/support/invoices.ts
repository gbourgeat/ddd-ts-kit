import { and, eq } from 'drizzle-orm';
import { integer, text } from 'drizzle-orm/pg-core';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import { AggregateRoot, DomainError, type Repository } from '@ddd-ts-kit/kernel';
import { contextSchema, optimisticUpdate, type DrizzleContext } from '../../src/postgres.js';

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

export class Invoice extends AggregateRoot {
  #amount: number;
  #status: 'draft' | 'issued';

  private constructor(id: string, amount: number, status: 'draft' | 'issued') {
    super(id);
    this.#amount = amount;
    this.#status = status;
  }

  static draft(id: string, amount: number): Invoice {
    return new Invoice(id, amount, 'draft');
  }

  static rehydrate(state: { id: string; amount: number; status: 'draft' | 'issued' }): Invoice {
    return new Invoice(state.id, state.amount, state.status);
  }

  addCharge(amount: number): void {
    if (this.#status === 'issued') {
      throw new InvoiceAlreadyIssued(`Invoice ${this.id} is already issued`);
    }
    this.#amount += amount;
  }

  issue(): void {
    this.#status = 'issued';
  }

  get state(): { id: string; amount: number; status: 'draft' | 'issued' } {
    return { id: this.id, amount: this.#amount, status: this.#status };
  }
}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const billing = contextSchema('billing-core');

export const invoices = billing.table('invoices', {
  id: text('id').primaryKey(),
  amount: integer('amount').notNull(),
  status: text('status').$type<'draft' | 'issued'>().notNull(),
  version: integer('version').notNull(),
});

/** The repository a consuming project would write: no transaction in sight. */
export class DrizzleInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: DrizzleContext<PgliteQueryResultHKT>) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.context.executor().select().from(invoices).where(eq(invoices.id, id));
    if (row === undefined) {
      return undefined;
    }
    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const db = this.context.executor();
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      const written =
        expected === 0
          ? await db.insert(invoices).values(row).onConflictDoNothing().returning({ id: invoices.id })
          : await db
              .update(invoices)
              .set(row)
              .where(and(eq(invoices.id, invoice.id), eq(invoices.version, expected)))
              .returning({ id: invoices.id });
      return written.length;
    });
  }
}
