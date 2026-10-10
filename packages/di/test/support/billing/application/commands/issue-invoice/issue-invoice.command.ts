import { Command } from '@ddd-ts-kit/kernel';

export class IssueInvoice extends Command {
  constructor(readonly orderId: string) {
    super();
  }
}
