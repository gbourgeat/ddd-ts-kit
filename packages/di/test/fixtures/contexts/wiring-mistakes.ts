import {
  Clock,
  CommandBus,
  FixedClock,
  IdGenerator,
  systemActor,
  type Command,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import {
  Adapter,
  CommandHandler,
  IntegrationEventHandler,
  QueryHandler,
  Repository,
} from '@ddd-ts-kit/kernel/declarations';
import { IssueInvoice } from './billing/application/commands/issue-invoice/issue-invoice.command';
import { CustomerDirectory } from './billing/application/ports/customer-directory.port';
import { Mailer } from './billing/application/ports/mailer.port';
import { GetInvoice } from './billing/application/queries/get-invoice/get-invoice.query';
import type { Invoice } from './billing/domain/invoice';
import { InvoiceRepository } from './billing/domain/repositories/invoice.repository';
import { InMemoryInvoiceRepository } from './billing/infrastructure/persistence/in-memory-invoice.repository';
import { OrderPlaced, type OrderPlacedPayload } from './billing/published-language/order-placed';

/** Classes that only exist to make a wiring check fail, when the application is created or when they compile. */

@CommandHandler(IssueInvoice)
export class SecondIssueInvoiceHandler {
  async execute(_command: IssueInvoice): Promise<string> {
    return 'second';
  }
}

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [CommandBus])
export class SecondInvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<OrderPlacedPayload>): Promise<void> => {
    await this.commands.execute(new IssueInvoice(systemActor('second'), event.payload.customerId));
  };
}

export abstract class Chicken {
  abstract readonly hatchedFrom: Egg;
}

export abstract class Egg {
  abstract readonly laidBy: Chicken;
}

@Adapter(Chicken, [Egg])
export class HatchedChicken implements Chicken {
  constructor(readonly hatchedFrom: Egg) {}
}

@Adapter(Egg, [Chicken])
export class LaidEgg implements Egg {
  constructor(readonly laidBy: Chicken) {}
}

@Adapter(Clock, { replaces: true })
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

/*
 * What the compiler refuses, in every decorator mode. Each class below is a mistake a project
 * makes, and none is ever listed in a module.
 */

// @ts-expect-error an adapter implements every member of its port: `send` is missing
@Adapter(Mailer)
export class SilentMailer {
  async queue(_to: string): Promise<void> {}
}

// @ts-expect-error the first dependency must be the port of the first parameter: a Mailer is no InvoiceRepository
@QueryHandler(GetInvoice, [Mailer])
export class GetInvoiceFromTheMailer {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}

// @ts-expect-error the list follows the order of the constructor parameters
@Adapter(Mailer, [IdGenerator, Clock])
export class MisorderedMailer implements Mailer {
  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async send(to: string): Promise<void> {
    void `${to} ${this.ids.next()} ${this.clock.now().toISOString()}`;
  }
}

/**
 * Compiles: without a list the constructor states the dependency. Nothing registered what was
 * read from it, so the composition root refuses the class by name instead of building it.
 */
@QueryHandler(GetInvoice)
export class GetInvoiceWithoutList {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}

// @ts-expect-error one dependency too many: the constructor takes one parameter
@QueryHandler(GetInvoice, [InvoiceRepository, Clock])
export class GetInvoiceWithOneTooMany {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}

// @ts-expect-error the list names the port, not the in-memory class that implements it
@QueryHandler(GetInvoice, [InMemoryInvoiceRepository])
export class GetInvoiceFromMemory {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}

// @ts-expect-error a repository adapter implements its port: a customer directory is no invoice repository
@Repository(InvoiceRepository)
export class DirectoryAsRepository implements CustomerDirectory {
  async exists(): Promise<boolean> {
    return false;
  }
}
