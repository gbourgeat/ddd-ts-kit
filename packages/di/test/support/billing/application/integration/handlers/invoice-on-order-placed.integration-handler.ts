import type { CommandBus, IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OrderPlacedPayload } from '../../../../ordering/published-language/order-placed.js';
import { IssueInvoice } from '../../commands/issue-invoice/issue-invoice.command.js';

export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(event.payload.orderId));
  }
}
