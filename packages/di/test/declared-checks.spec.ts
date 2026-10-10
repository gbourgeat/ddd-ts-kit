import { describe, expect, it } from 'vitest';
import { AuthorizedCommand, Clock, type Actor } from '@ddd-ts-kit/kernel';
import {
  UseCaseDeclarations,
  UseCaseGuard,
  contextModule,
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
} from '../src/index.js';
import * as billing from './fixtures/contexts/billing/billing.declarations.js';
import * as mistakes from './fixtures/contexts/wiring-mistakes.js';
import { permissions } from './fixtures/contexts/billing/application/authorization/billing.permissions.js';
import { Outbox } from './support/fakes/outbox.js';
import { wiringFailure } from './support/failure.js';

const { GetInvoice, InMemoryInvoiceRepository, InvoiceIssuedEventHandler, IssueInvoice, IssueInvoiceHandler, Mailer, OutboxMailer } = billing;

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

/** The decorator applied by hand, for a class a spec writes on the spot. */
function handling<M extends AuthorizedCommand>(
  message: abstract new (...args: never[]) => M,
  handler: new () => { execute(command: M): Promise<void> },
): typeof handler {
  mistakes.declareHandler(message, handler);

  return handler;
}

describe('access declared on the message', () => {
  const billingModule = contextModule('billing', billing);
  const guard: UseCaseGuard = { check: (_message, next) => next() };

  const guarded = defineContextModule({
    name: 'authorization',
    register(builder) {
      builder.bind(UseCaseGuard).toValue(guard);
    },
  });

  it('satisfies an application that requires authorization', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule, guarded], authorization: 'required' });
    const [issuing] = app.resolve(UseCaseDeclarations).list;

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
      'Token "InvoiceRepository" is bound twice: by module "billing" (declared by class InMemoryInvoiceRepository) and by module "invoicing" (declared by class InMemoryInvoiceRepository).',
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
      '"IssueInvoiceHandler" in module "billing" (declared by class IssueInvoiceHandler) depends on "InvoiceRepository", which no module binds.',
    );
  });

  it('refuses a cycle between declared classes', () => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), contextModule('loop', [mistakes.HatchedChicken, mistakes.LaidEgg])] }),
    );

    expect(failure.code).toBe('DEPENDENCY_CYCLE');
    expect(failure.message).toContain('"Chicken" -> "Egg" -> "Chicken"');
  });

  it('refuses event handlers without the kernel they attach to', () => {
    const failure = wiringFailure(() => createApplication({ modules: [contextModule('billing', [InvoiceIssuedEventHandler, OutboxMailer])] }));

    expect(failure.code).toBe('UNBOUND_DEPENDENCY');
  });

  it('refuses a class that replaces a binding nobody made', () => {
    const failure = wiringFailure(() => createApplication({ modules: [contextModule('platform', [mistakes.FrozenClock])] }));

    expect(failure.code).toBe('NOTHING_TO_REBIND');
    expect(failure.message).toContain('Module "platform" (declared by class FrozenClock) rebinds "Clock"');
  });
});

describe('declared and explicit styles together', () => {
  const billingModule = contextModule('billing', billing);

  it('a declared class replaces a default of the kernel when it says so', () => {
    const app = createApplication({ modules: [kernelModule(), contextModule('platform', [mistakes.FrozenClock])] });

    expect(app.resolve(Clock).now()).toEqual(new Date(0));
    expect(app.describe().bindings).toContainEqual(expect.objectContaining({ token: 'Clock', module: 'platform', origin: 'declared' }));
  });

  it('an explicit module rebinds a declared port', async () => {
    const outbox = new Outbox();

    const overriding = defineContextModule({
      name: 'testing',
      register(builder) {
        builder.rebind(Mailer).toValue(outbox);
      },
    });

    const app = createTestApplication({ modules: [billingModule, overriding] });

    await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'));

    expect(outbox.sent).toEqual(['customer-1: Invoice id-1']);
  });

  it('one module mixes included classes and explicit statements', async () => {
    abstract class TaxRate {
      abstract readonly value: number;
    }

    const mixed = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.include(billing);
        builder.bind(TaxRate).toValue({ value: 0.2 });
      },
    });

    const app = createTestApplication({ modules: [mixed] });

    expect(app.get(TaxRate).value).toBe(0.2);
    expect(await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'))).toBe('id-1');
  });

  it('a declared context and an explicit one share an application', async () => {
    abstract class Warehouse {
      abstract readonly name: string;
    }

    const ordering = defineContextModule({
      name: 'ordering',
      register(builder) {
        builder.bind(Warehouse).toValue({ name: 'north' });
      },
    });

    const app = createApplication({ modules: [kernelModule(), ordering, billingModule] });

    expect(app.describe().modules).toEqual(['kernel', 'ordering', 'billing']);
  });
});
