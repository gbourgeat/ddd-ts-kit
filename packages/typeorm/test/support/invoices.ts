import { EntitySchema } from 'typeorm';
import { AggregateRoot, DomainError, type Repository } from '@ddd-ts-kit/kernel';
import {
  insertIgnoringConflict,
  optimisticUpdate,
  schemaNameOf,
  type TypeOrmContext,
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

interface InvoiceRow extends InvoiceState {
  version: number;
}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'),
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    version: { type: 'int' },
  },
});

/** The repository a consuming project would write: no transaction in sight. */
export class TypeOrmInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: TypeOrmContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id });
    if (row === null) {
      return undefined;
    }
    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const manager = this.context.manager();
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      if (expected === 0) {
        return (await insertIgnoringConflict(manager, invoices, row)) ? 1 : 0;
      }
      const updated = await manager.update(invoices, { id: invoice.id, version: expected }, row);
      return updated.affected ?? 0;
    });
  }
}
