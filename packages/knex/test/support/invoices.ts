import type { Knex } from 'knex';
import { AggregateRoot, DomainError, type Repository } from '@ddd-ts-kit/kernel';
import {
  insertIgnoringConflict,
  optimisticUpdate,
  schemaNameOf,
  type KnexContext,
} from '../../src/index.js';

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

interface InvoiceState {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
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

  static rehydrate(state: InvoiceState): Invoice {
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

  get state(): InvoiceState {
    return { id: this.id, amount: this.#amount, status: this.#status };
  }
}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const BILLING = schemaNameOf('billing-core');

/** What the migration of the context would contain. */
export async function createInvoicesTable(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(BILLING);
  await knex.schema.withSchema(BILLING).createTable('invoices', (table) => {
    table.text('id').primary();
    table.integer('amount').notNullable();
    table.text('status').notNullable();
    table.integer('version').notNullable();
  });
}

interface InvoiceRow extends InvoiceState {
  version: number;
}

/** The repository a consuming project would write: no transaction in sight. */
export class KnexInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: KnexContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.#invoices().where({ id }).first();
    if (row === undefined) {
      return undefined;
    }
    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      if (expected === 0) {
        const inserted = await insertIgnoringConflict(this.context.executor(), this.#invoices(), { row, conflict: 'id' });
        return inserted ? 1 : 0;
      }
      return this.#invoices().where({ id: invoice.id, version: expected }).update(row);
    });
  }

  #invoices(): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
    return this.context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
  }
}
