import { CommandBus, systemActor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from '../../../published-language/order-placed';
import { IssueInvoice } from '../../commands/issue-invoice/issue-invoice.command';

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [CommandBus])
export class InvoiceOnOrderPlaced implements IntegrationEventHandler<OrderPlacedPayload> {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<OrderPlacedPayload>): Promise<void> => {
    await this.commands.execute(
      new IssueInvoice(systemActor('billing.invoice-on-order-placed'), event.payload.customerId),
    );
  };
}
