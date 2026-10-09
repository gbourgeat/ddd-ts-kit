import { AggregateRoot, DomainError, type Repository } from '@ddd-ts-kit/kernel';
import { optimisticUpdate, type PrismaContext } from '../../src/index.js';
import type { Prisma } from '../generated/client/client.js';

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

/** The repository a consuming project would write: no transaction in sight. */
export class PrismaInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: PrismaContext<Prisma.TransactionClient>) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.client().invoice.findUnique({ where: { id } });
    if (row === null) {
      return undefined;
    }
    const invoice = Invoice.rehydrate({ ...row, status: row.status === 'issued' ? 'issued' : 'draft' });
    invoice.version = row.version;
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const invoices = this.context.client().invoice;
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      const written =
        expected === 0
          ? await invoices.createMany({ data: [row], skipDuplicates: true })
          : await invoices.updateMany({ where: { id: invoice.id, version: expected }, data: row });
      return written.count;
    });
  }
}
