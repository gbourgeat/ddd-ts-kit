import { describe, expect, it } from 'vitest';
import { AuthorizedCommand, FixedClock, systemActor, type Actor, type BusMiddleware } from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  DECLARED_POLICIES,
  DOMAIN_EVENTS,
  USE_CASE_DECLARATIONS,
  USE_CASE_GUARD,
  contextModule,
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  token,
  type BindingInfo,
} from '../src/index.js';
import * as billing from './fixtures/contexts/billing/billing.declarations.js';
import * as mistakes from './fixtures/contexts/wiring-mistakes.js';
import { permissions } from './fixtures/contexts/billing/application/authorization/billing.permissions.js';
import { InvoiceIssued } from './fixtures/contexts/billing/domain/events/invoice-issued.event.js';
import { wiringFailure } from './support/failure.js';

const {
  CUSTOMERS,
  GetInvoice,
  GetInvoiceHandler,
  INVOICES,
  InMemoryInvoiceRepository,
  InvoiceIssuedEventHandler,
  InvoiceOnOrderPlaced,
  IssueInvoice,
  IssueInvoiceHandler,
  MAILER,
  OnlyIssuerVoids,
  OutboxMailer,
  RegistryCustomerGateway,
  wrappedMailers,
} = billing;

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const listed = [
  IssueInvoice,
  IssueInvoiceHandler,
  GetInvoice,
  GetInvoiceHandler,
  InvoiceIssuedEventHandler,
  InvoiceOnOrderPlaced,
  OnlyIssuerVoids,
  InMemoryInvoiceRepository,
  OutboxMailer,
  RegistryCustomerGateway,
];

class Outbox {
  readonly sent: string[] = [];

  async send(to: string, subject: string): Promise<void> {
    this.sent.push(`${to}: ${subject}`);
  }
}

describe.each([
  ['a list of classes', () => contextModule('billing', listed)],
  ['the namespace of a barrel', () => contextModule('billing', billing)],
  ['a list of lists and namespaces', () => contextModule('billing', [[IssueInvoice, IssueInvoiceHandler], billing])],
])('a context declared by its classes, given as %s', (_form, billingModule) => {
  it('boots alone on the kernel: handlers on the buses, adapters behind their ports', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule()] });

    const invoiceId = await app.resolve(COMMAND_BUS).execute(new IssueInvoice(ada, 'customer-1'));

    expect(app.resolve(INVOICES)).toBeInstanceOf(InMemoryInvoiceRepository);
    expect(await app.resolve(INVOICES).findById(invoiceId)).toMatchObject({ customerId: 'customer-1', issuedBy: 'ada' });
  });

  it('runs on the test application, with fakes in place of the declared adapters', async () => {
    const outbox = new Outbox();
    const app = createTestApplication({
      modules: [billingModule()],
      fakes: [fake(MAILER, outbox), fake(CUSTOMERS, { exists: async () => true })],
    });

    const invoiceId = await app.commandBus.execute(new IssueInvoice(ada, 'anybody'));

    expect(invoiceId).toBe('id-1');
    expect(await app.queryBus.execute(new GetInvoice('id-1'))).toMatchObject({ id: 'id-1', customerId: 'anybody' });
    expect(app.eventBus.published).toMatchObject([{ type: 'billing.invoice.issued', payload: { invoiceId: 'id-1' } }]);
    expect(outbox.sent).toEqual(['anybody: Invoice id-1']);
  });
});

describe('a declared context', () => {
  const billingModule = contextModule('billing', billing);

  it('builds nothing until a message needs it', async () => {
    const built = IssueInvoiceHandler.built;
    const app = createTestApplication({ modules: [billingModule] });

    expect(IssueInvoiceHandler.built).toBe(built);
    await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'));
    await app.commandBus.execute(new IssueInvoice(ada, 'customer-2'));

    expect(IssueInvoiceHandler.built).toBe(built + 1);
  });

  it('subscribes its event listeners when the application starts, once per consumer name', async () => {
    const app = createTestApplication({ modules: [billingModule] });
    const placed = { id: 'evt-1', type: 'ordering.order.placed', version: 1, occurredAt: '2026-01-01T00:00:00.000Z', payload: { orderId: 'order-1', customerId: 'customer-9' } };
    await app.start();

    await app.eventBus.publish([placed]);
    await app.eventBus.publish([placed]);

    expect(await app.queryBus.execute(new GetInvoice('id-1'))).toMatchObject({
      customerId: 'customer-9',
      issuedBy: systemActor('billing.invoice-on-order-placed').id,
    });
    expect(await app.queryBus.execute(new GetInvoice('id-3'))).toBeUndefined();
  });

  it('attaches its domain event listeners to the dispatcher, and leaves alone an event of another class', async () => {
    const outbox = new Outbox();
    const app = createTestApplication({ modules: [billingModule], fakes: [fake(MAILER, outbox)] });

    await app.domainEvents.dispatch([new InvoiceIssued('inv-7', new Date(0), 'customer-7')]);
    await app.domainEvents.dispatch([{ name: 'billing.invoice.issued', aggregateId: 'inv-8', occurredAt: new Date(0) }]);

    expect(outbox.sent).toEqual(['customer-7: Invoice inv-7']);
    expect(app.get(DOMAIN_EVENTS)).toBe(app.domainEvents);
  });

  it('gives its adapters the role, the lifetime and the aspects they declared', () => {
    const seen: BindingInfo[] = [];
    const app = createApplication({
      modules: [kernelModule({ clock: new FixedClock(new Date(0)) }), billingModule],
      decorate: (instance, info) => {
        seen.push(info);
        return instance;
      },
    });
    wrappedMailers.length = 0;

    const first = app.resolve(MAILER);
    const second = app.resolve(MAILER);

    expect(first).toBeInstanceOf(OutboxMailer);
    expect(second).not.toBe(first);
    expect(app.resolve(INVOICES)).toBe(app.resolve(INVOICES));
    expect(wrappedMailers).toEqual(Array(2).fill('OutboxMailer as external in billing for billing.Mailer'));
    expect(seen).toContainEqual({ token: MAILER, context: 'billing', kind: 'external' });
    expect(seen).toContainEqual({ token: INVOICES, context: 'billing', kind: 'repository' });
  });

  it('describes what it declared, with its origin', () => {
    const description = createApplication({ modules: [kernelModule(), billingModule] }).describe();

    expect(description.bindings).toContainEqual({
      token: 'billing.Mailer',
      module: 'billing',
      kind: 'external',
      lifetime: 'transient',
      source: 'class',
      implementation: 'OutboxMailer',
      dependencies: ['kernel.Clock'],
      overridden: false,
      origin: 'declared',
      declaredBy: 'OutboxMailer',
    });
    expect(description.commands).toEqual([
      { message: 'IssueInvoice', handler: 'IssueInvoiceHandler', module: 'billing', access: 'protected', permission: 'billing:invoice.issue', origin: 'declared', declaredBy: 'IssueInvoiceHandler' },
    ]);
    expect(description.queries).toEqual([
      { message: 'GetInvoice', handler: 'GetInvoiceHandler', module: 'billing', access: 'public', origin: 'declared', declaredBy: 'GetInvoiceHandler' },
    ]);
    expect(description.subscriptions).toEqual([
      { event: 'ordering.order.placed', version: 1, consumer: 'billing.invoice-on-order-placed', handler: 'InvoiceOnOrderPlaced', module: 'billing', origin: 'declared', declaredBy: 'InvoiceOnOrderPlaced' },
    ]);
    expect(description.reactions).toEqual([
      { event: 'InvoiceIssued', name: 'billing.invoice.issued', handler: 'InvoiceIssuedEventHandler', module: 'billing', origin: 'declared', declaredBy: 'InvoiceIssuedEventHandler' },
    ]);
    expect(description.policies).toEqual([
      { name: 'billing.only-issuer-voids', permission: 'billing:invoice.void', policy: 'OnlyIssuerVoids', module: 'billing', origin: 'declared', declaredBy: 'OnlyIssuerVoids' },
    ]);
    expect(description.bindings.find((binding) => binding.token === 'kernel.Clock')).not.toHaveProperty('origin');
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });

  it('hands its policies to whoever evaluates them, each under the token that builds it', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    const [declared] = app.resolve(DECLARED_POLICIES);

    expect(declared).toMatchObject({ name: 'billing.only-issuer-voids', permission: permissions['invoice.void'], module: 'billing' });
    expect(declared === undefined ? undefined : app.resolve(declared.policy)).toBeInstanceOf(OnlyIssuerVoids);
  });
});

describe('access declared on the message', () => {
  const billingModule = contextModule('billing', billing);
  const guard: BusMiddleware = (_message, next) => next();
  const guarded = defineContextModule({
    name: 'authorization',
    register(builder) {
      builder.bind(USE_CASE_GUARD).toValue(guard);
    },
  });

  it('satisfies an application that requires authorization', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule, guarded], authorization: 'required' });
    const [issuing] = app.resolve(USE_CASE_DECLARATIONS);

    expect(issuing).toMatchObject({ kind: 'command', message: IssueInvoice, access: 'protected', permission: permissions['invoice.issue'] });
    expect(issuing?.resourceOf?.(new IssueInvoice(ada, 'customer-4'))).toEqual({ type: 'customer', id: 'customer-4' });
  });

  it('is read by an explicit module that binds the handler of a decorated message', () => {
    const explicit = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.command(IssueInvoice).handledByFactory(() => ({ execute: async () => 'invoice-1' }));
        builder.query(GetInvoice).handledByFactory(() => ({ execute: async () => undefined }));
      },
    });

    const app = createApplication({ modules: [kernelModule(), explicit, guarded], authorization: 'required' });

    expect(app.describe().commands).toEqual([
      { message: 'IssueInvoice', handler: 'command(IssueInvoice) handler', module: 'billing', access: 'protected', permission: 'billing:invoice.issue' },
    ]);
    expect(app.describe().queries).toMatchObject([{ access: 'public' }]);
  });

  it('refuses a declared handler whose message says nothing, naming the class and the remedy', () => {
    class VoidInvoice extends AuthorizedCommand {}
    class VoidInvoiceHandler {
      async execute(_command: VoidInvoice): Promise<void> {}
    }
    const voiding = contextModule('voiding', [handling(VoidInvoice, VoidInvoiceHandler)]);

    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), voiding, guarded], authorization: 'required' }),
    );

    expect(failure.code).toBe('UNDECLARED_AUTHORIZATION');
    expect(failure.message).toContain('the command "VoidInvoice" (module "voiding" (declared by class VoidInvoiceHandler))');
    expect(failure.message).toContain('Decorate the message class with @Requires(permission) or @Public().');
  });
});

/** The decorator applied by hand, for a class a spec writes on the spot. */
function handling<M extends AuthorizedCommand>(
  message: abstract new (...args: never[]) => M,
  handler: new () => { execute(command: M): Promise<void> },
): typeof handler {
  mistakes.declareHandler(message, handler);
  return handler;
}

describe('the checks, on declared classes', () => {
  const billingModule = contextModule('billing', billing);

  it('refuses a class listed without a declaration', () => {
    class Forgotten {}

    const failure = wiringFailure(() => createApplication({ modules: [kernelModule(), contextModule('billing', [Forgotten])] }));

    expect(failure.code).toBe('UNDECLARED_CLASS');
    expect(failure.message).toContain('Class Forgotten is listed in module "billing" and carries no declaration decorator');
  });

  it('refuses a port bound twice, naming both classes', () => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), billingModule, contextModule('invoicing', [InMemoryInvoiceRepository])] }),
    );

    expect(failure.code).toBe('DUPLICATE_BINDING');
    expect(failure.message).toBe(
      'Token "billing.InvoiceRepository" is bound twice: by module "billing" (declared by class InMemoryInvoiceRepository) and by module "invoicing" (declared by class InMemoryInvoiceRepository).',
    );
  });

  it('refuses a message handled twice and a consumer name used twice', () => {
    const twice = (classes: readonly (abstract new (...args: never) => unknown)[]) =>
      wiringFailure(() =>
        createApplication({ modules: [kernelModule(), billingModule, contextModule('copy', classes)] }),
      );

    expect(twice([mistakes.SecondIssueInvoiceHandler])).toMatchObject({ code: 'DUPLICATE_HANDLER' });
    expect(twice([mistakes.SecondIssueInvoiceHandler]).message).toContain(
      '"SecondIssueInvoiceHandler" in module "copy" (declared by class SecondIssueInvoiceHandler)',
    );
    expect(twice([mistakes.SecondInvoiceOnOrderPlaced])).toMatchObject({ code: 'DUPLICATE_CONSUMER' });
  });

  it('refuses a dependency nobody binds, naming the class that asks for it', () => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), contextModule('billing', [IssueInvoiceHandler])] }),
    );

    expect(failure.code).toBe('UNBOUND_DEPENDENCY');
    expect(failure.message).toBe(
      '"IssueInvoiceHandler" in module "billing" (declared by class IssueInvoiceHandler) depends on "billing.InvoiceRepository", which no module binds.',
    );
  });

  it('refuses a cycle between declared classes', () => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), contextModule('loop', [mistakes.Chicken, mistakes.Egg])] }),
    );

    expect(failure.code).toBe('DEPENDENCY_CYCLE');
    expect(failure.message).toContain('"loop.Chicken" -> "loop.Egg" -> "loop.Chicken"');
  });

  it('refuses listeners without the kernel they attach to', () => {
    const failure = wiringFailure(() => createApplication({ modules: [contextModule('billing', [InvoiceIssuedEventHandler, OutboxMailer])] }));

    expect(failure.code).toBe('UNBOUND_DEPENDENCY');
  });

  it('refuses a class that replaces a binding nobody made', () => {
    const failure = wiringFailure(() => createApplication({ modules: [contextModule('platform', [mistakes.FrozenClock])] }));

    expect(failure.code).toBe('NOTHING_TO_REBIND');
    expect(failure.message).toContain('Module "platform" (declared by class FrozenClock) rebinds "kernel.Clock"');
  });
});

describe('declared and explicit styles together', () => {
  const billingModule = contextModule('billing', billing);

  it('a declared class replaces a default of the kernel when it says so', () => {
    const app = createApplication({ modules: [kernelModule(), contextModule('platform', [mistakes.FrozenClock])] });

    expect(app.resolve(CLOCK).now()).toEqual(new Date(0));
    expect(app.describe().bindings).toContainEqual(expect.objectContaining({ token: 'kernel.Clock', module: 'platform', origin: 'declared' }));
  });

  it('an explicit module rebinds a declared port', async () => {
    const outbox = new Outbox();
    const overriding = defineContextModule({
      name: 'testing',
      register(builder) {
        builder.rebind(MAILER).toValue(outbox);
      },
    });
    const app = createTestApplication({ modules: [billingModule, overriding] });

    await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'));

    expect(outbox.sent).toEqual(['customer-1: Invoice id-1']);
  });

  it('one module mixes included classes and explicit statements', async () => {
    const TAX_RATE = token<number>('billing.TaxRate');
    const mixed = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.include(billing);
        builder.bind(TAX_RATE).toValue(0.2);
      },
    });
    const app = createTestApplication({ modules: [mixed] });

    expect(app.get(TAX_RATE)).toBe(0.2);
    expect(await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'))).toBe('id-1');
  });

  it('a declared context and an explicit one share an application', async () => {
    const ordering = defineContextModule({
      name: 'ordering',
      register(builder) {
        builder.bind(token<string>('ordering.Name')).toValue('ordering');
      },
    });
    const app = createApplication({ modules: [kernelModule(), ordering, billingModule] });

    expect(app.describe().modules).toEqual(['kernel', 'ordering', 'billing']);
  });
});
