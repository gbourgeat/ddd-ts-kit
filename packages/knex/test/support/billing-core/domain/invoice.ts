import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { InvoiceAlreadyIssued } from './errors/invoice-already-issued';

export interface InvoiceState {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
}

export class Invoice extends AggregateRoot {
  private amount: number;

  private status: 'draft' | 'issued';

  private constructor(id: string, amount: number, status: 'draft' | 'issued') {
    super(id);
    this.amount = amount;
    this.status = status;
  }

  static draft(id: string, amount: number): Invoice {
    return new Invoice(id, amount, 'draft');
  }

  static rehydrate(state: InvoiceState): Invoice {
    return new Invoice(state.id, state.amount, state.status);
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
    return { id: this.id, amount: this.amount, status: this.status };
  }
}
