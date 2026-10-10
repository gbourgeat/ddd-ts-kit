import { FixedClock, systemActor, type Clock, type Command, type CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { Adapter, CLOCK, COMMAND_BUS, CommandHandler, IntegrationEventHandler, token } from '@ddd-ts-kit/kernel/declarations';
import { IssueInvoice } from './billing/application/commands/issue-invoice/issue-invoice.command.js';
import { OrderPlaced, type OrderPlacedPayload } from './billing/published-language/order-placed.js';

/** Classes that only exist to make a wiring check fail. */

@CommandHandler(IssueInvoice)
export class SecondIssueInvoiceHandler {
  async execute(_command: IssueInvoice): Promise<string> {
    return 'second';
  }
}

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [COMMAND_BUS])
export class SecondInvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<OrderPlacedPayload>): Promise<void> => {
    await this.commands.execute(new IssueInvoice(systemActor('second'), event.payload.customerId));
  };
}

export const CHICKEN = token<Chicken>('loop.Chicken');
export const EGG = token<Egg>('loop.Egg');

@Adapter(CHICKEN, [EGG])
export class Chicken {
  constructor(readonly egg: Egg) {}
}

@Adapter(EGG, [CHICKEN])
export class Egg {
  constructor(readonly chicken: Chicken) {}
}

@Adapter(CLOCK, { replaces: true })
export class FrozenClock extends FixedClock implements Clock {
  constructor() {
    super(new Date(0));
  }
}

/** `@CommandHandler(message)` applied by hand, for a handler a spec writes on the spot. */
export function declareHandler<M extends Command<unknown>>(
  message: abstract new (...args: never[]) => M,
  handler: new () => { execute(command: M): Promise<unknown> },
): void {
  Reflect.apply(CommandHandler(message), undefined, [handler]);
}
