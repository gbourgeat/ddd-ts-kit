import { AggregateRoot } from '@ddd-ts-kit/kernel';
import type { JsonDocument } from '../../../../src';
import { InvoiceAlreadyIssued } from './errors/invoice-already-issued';

export interface InvoiceState {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  /** Free-form details kept in a JSON column: an object, a list, a string. TypeORM types `null` out of it. */
  details?: JsonDocument;
}

export class Invoice extends AggregateRoot {
  private amount: number;

  private status: 'draft' | 'issued';

  private details: JsonDocument | undefined;

  private constructor(id: string, amount: number, status: 'draft' | 'issued', details?: JsonDocument) {
    super(id);
    this.amount = amount;
    this.status = status;
    this.details = details;
  }

  static draft(id: string, amount: number): Invoice {
    return new Invoice(id, amount, 'draft');
  }

  static rehydrate(state: InvoiceState): Invoice {
    return new Invoice(state.id, state.amount, state.status, state.details ?? undefined);
  }

  static draftWithDetails(id: string, amount: number, details: JsonDocument): Invoice {
    return new Invoice(id, amount, 'draft', details);
  }

  addCharge(amount: number): void {
    if (this.status === 'issued') {
      throw new InvoiceAlreadyIssued(`Invoice ${this.id} is already issued`);
    }

    this.amount += amount;
  }

  issue(): void {
    this.status = 'issued';
  }

  get state(): InvoiceState {
    return {
      id: this.id,
      amount: this.amount,
      status: this.status,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}
