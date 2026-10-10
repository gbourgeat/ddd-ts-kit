import { systemActor, type CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { COMMAND_BUS, IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from '../../../published-language/order-placed.js';
import { IssueInvoice } from '../../commands/issue-invoice/issue-invoice.command.js';

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [COMMAND_BUS])
export class InvoiceOnOrderPlaced implements IntegrationEventHandler<OrderPlacedPayload> {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<OrderPlacedPayload>): Promise<void> => {
    await this.commands.execute(new IssueInvoice(systemActor('billing.invoice-on-order-placed'), event.payload.customerId));
  };
}
