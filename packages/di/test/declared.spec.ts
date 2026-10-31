import { describe, expect, it } from 'vitest';
import { CommandBus, DomainEventDispatcher, FixedClock, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import { DeclaredPolicies, contextModule, fake, kernelModule, type BindingInfo } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import * as billing from './fixtures/contexts/billing/billing.declarations';
import { permissions } from './fixtures/contexts/billing/application/authorization/billing.permissions';
import { InvoiceIssued } from './fixtures/contexts/billing/domain/events/invoice-issued.event';
import { Outbox } from './support/fakes/outbox';

const {
  CustomerDirectory,
  GetInvoice,
  GetInvoiceHandler,
  InMemoryInvoiceRepository,
  InvoiceIssuedEventHandler,
  InvoiceIssuedPublisher,
  InvoiceOnOrderPlaced,
  InvoiceRepository,
  IssueInvoice,
  IssueInvoiceHandler,
  Mailer,
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
  InvoiceIssuedPublisher,
  InvoiceOnOrderPlaced,
  OnlyIssuerVoids,
  InMemoryInvoiceRepository,
  OutboxMailer,
  RegistryCustomerGateway,
];

describe.each([
  ['a list of classes', () => contextModule('billing', listed)],
  ['the namespace of a barrel', () => contextModule('billing', billing)],
  ['a list of lists and namespaces', () => contextModule('billing', [[IssueInvoice, IssueInvoiceHandler], billing])],
])('a context declared by its classes, given as %s', (_form, billingModule) => {
  it('boots alone on the kernel: handlers on the buses, adapters behind their ports', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule()] });

    const invoiceId = await app.resolve(CommandBus).execute(new IssueInvoice(ada, 'customer-1'));

    expect(app.resolve(InvoiceRepository)).toBeInstanceOf(InMemoryInvoiceRepository);

    expect(await app.resolve(InvoiceRepository).findById(invoiceId)).toMatchObject({
      customerId: 'customer-1',
      issuedBy: 'ada',
    });
  });

  it('runs on the test application, with fakes in place of the declared adapters', async () => {
    const outbox = new Outbox();

    const app = createTestApplication({
      modules: [billingModule()],
      fakes: [fake(Mailer, outbox), fake(CustomerDirectory, { exists: async () => true })],
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

  it('subscribes its integration event handlers when the application starts, once per consumer name', async () => {
    const app = createTestApplication({ modules: [billingModule] });

    const placed = {
      id: 'evt-1',
      type: 'ordering.order.placed',
      version: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: { orderId: 'order-1', customerId: 'customer-9' },
    };

    await app.start();

    await app.eventBus.publish([placed]);
    await app.eventBus.publish([placed]);

    expect(await app.queryBus.execute(new GetInvoice('id-1'))).toMatchObject({
      customerId: 'customer-9',
      issuedBy: systemActor('billing.invoice-on-order-placed').id,
    });

    expect(await app.queryBus.execute(new GetInvoice('id-3'))).toBeUndefined();
  });

  it('attaches its domain event handlers to the dispatcher, and leaves alone an event of another class', async () => {
    const outbox = new Outbox();
    const app = createTestApplication({ modules: [billingModule], fakes: [fake(Mailer, outbox)] });

    await app.domainEvents.dispatch([new InvoiceIssued('inv-7', new Date(0), 'customer-7')]);

    await app.domainEvents.dispatch([
      { name: 'billing.invoice.issued', aggregateId: 'inv-8', occurredAt: new Date(0) },
    ]);

    expect(outbox.sent).toEqual(['customer-7: Invoice inv-7']);
    expect(app.get(DomainEventDispatcher)).toBe(app.domainEvents);
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

    const first = app.resolve(Mailer);
    const second = app.resolve(Mailer);

    expect(first).toBeInstanceOf(OutboxMailer);
    expect(second).not.toBe(first);
    expect(app.resolve(InvoiceRepository)).toBe(app.resolve(InvoiceRepository));
    expect(wrappedMailers).toEqual(Array(2).fill('OutboxMailer as external in billing for Mailer'));
    expect(seen).toContainEqual({ token: Mailer, context: 'billing', kind: 'external' });
    expect(seen).toContainEqual({ token: InvoiceRepository, context: 'billing', kind: 'repository' });
  });
});

describe('what a declared context says of itself', () => {
  const billingModule = contextModule('billing', billing);

  it('describes what it declared, with its origin', () => {
    const description = createApplication({ modules: [kernelModule(), billingModule] }).describe();

    expect(description.bindings).toContainEqual({
      token: 'Mailer',
      module: 'billing',
      kind: 'external',
      lifetime: 'transient',
      source: 'class',
      implementation: 'OutboxMailer',
      dependencies: ['Clock'],
      overridden: false,
      origin: 'declared',
      declaredBy: 'OutboxMailer',
    });

    expect(description.commands).toEqual([
      {
        message: 'IssueInvoice',
        handler: 'IssueInvoiceHandler',
        module: 'billing',
        access: 'protected',
        permission: 'billing:invoice.issue',
        origin: 'declared',
        declaredBy: 'IssueInvoiceHandler',
      },
    ]);

    expect(description.queries).toEqual([
      {
        message: 'GetInvoice',
        handler: 'GetInvoiceHandler',
        module: 'billing',
        access: 'public',
        origin: 'declared',
        declaredBy: 'GetInvoiceHandler',
      },
    ]);

    expect(description.integrationEventHandlers).toEqual([
      {
        event: 'ordering.order.placed',
        version: 1,
        consumer: 'billing.invoice-on-order-placed',
        handler: 'InvoiceOnOrderPlaced',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'InvoiceOnOrderPlaced',
      },
    ]);

    expect(description.domainEventHandlers).toEqual([
      {
        event: 'InvoiceIssued',
        name: 'billing.invoice.issued',
        phase: 'before-commit',
        handler: 'InvoiceIssuedEventHandler',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'InvoiceIssuedEventHandler',
      },
      {
        event: 'InvoiceIssued',
        name: 'billing.invoice.issued',
        phase: 'before-commit',
        handler: 'InvoiceIssuedPublisher',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'InvoiceIssuedPublisher',
      },
    ]);

    expect(description.policies).toEqual([
      {
        name: 'billing.only-issuer-voids',
        permission: 'billing:invoice.void',
        policy: 'OnlyIssuerVoids',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'OnlyIssuerVoids',
      },
    ]);

    expect(
      description.bindings.find((binding) => binding.token === 'Clock' && binding.module === 'kernel'),
    ).not.toHaveProperty('origin');

    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });

  it('hands its policies to whoever evaluates them, each resolved by its class', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    const [declared] = app.resolve(DeclaredPolicies).list;

    expect(declared).toMatchObject({
      name: 'billing.only-issuer-voids',
      permission: permissions['invoice.void'],
      module: 'billing',
    });

    expect(declared === undefined ? undefined : app.resolve(declared.policy)).toBeInstanceOf(OnlyIssuerVoids);
  });
});
