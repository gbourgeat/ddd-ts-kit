import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Clock, CommandBus, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';
import {
  createApplication,
  createTestApplication,
  fake,
  kernelModule,
  tokenIdentity,
  type ContextModule,
} from '../src/index.js';
import { discoverContext } from '../src/discovery.js';
import { decoratorModes, removeCompiled } from './support/decorator-modes.js';

type Billing = typeof import('./fixtures/contexts/billing/billing.declarations.js');
type Kernel = typeof import('@ddd-ts-kit/kernel');

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const BILLING = 'contexts/billing';
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

afterAll(() => {
  removeCompiled(FIXTURES);
});

interface Discovered {
  readonly directory: string;
  readonly extension: string;
  readonly billing: Billing;
  readonly module: ContextModule;
}

function describeDiscovery(label: string, discover: () => Promise<Omit<Discovered, 'module'>>): void {
  describe(`a context discovered from its directory, ${label}`, () => {
    let found: Discovered;

    beforeAll(async () => {
      const loaded = await discover();

      found = { ...loaded, module: await discoverContext('billing', pathToFileURL(`${loaded.directory}/`)) };
    }, 60_000);

    it('boots alone on the kernel and handles its messages', async () => {
      const { IssueInvoice, GetInvoice, CustomerDirectory } = found.billing;

      const app = createTestApplication({
        modules: [found.module],
        fakes: [fake(CustomerDirectory, { exists: async () => true })],
      });

      await app.start();

      const invoiceId = await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'));

      expect(await app.queryBus.execute(new GetInvoice(invoiceId))).toMatchObject({ customerId: 'customer-1' });
      expect(app.eventBus.published).toMatchObject([{ type: 'billing.invoice.issued', payload: { invoiceId } }]);
    });

    it('wires what it found in the order of the paths, whatever the disk answers first', () => {
      const description = createApplication({ modules: [kernelModule(), found.module] }).describe();
      const declared = description.bindings.filter((binding) => binding.module === 'billing');

      expect(declared.map((binding) => binding.implementation)).toEqual([
        'OnlyIssuerVoids',
        'IssueInvoiceHandler',
        'InvoiceIssuedEventHandler',
        'InvoiceOnOrderPlaced',
        'InvoiceIssuedPublisher',
        'GetInvoiceHandler',
        'IssueMonthlyInvoicesJob',
        'OutboxMailer',
        'RegistryCustomerGateway',
        'InMemoryInvoiceRepository',
      ]);
    });

    it('describes each binding with the file that declares it', () => {
      const description = createApplication({ modules: [kernelModule(), found.module] }).describe();
      const file = (relative: string) => path.join(found.directory, `${relative}${found.extension}`);

      expect(description.bindings).toContainEqual(
        expect.objectContaining({
          token: 'InvoiceRepository',
          origin: 'declared',
          declaredBy: 'InMemoryInvoiceRepository',
          file: file('infrastructure/persistence/in-memory-invoice.repository'),
        }),
      );

      expect(description.commands).toMatchObject([
        { message: 'IssueInvoice', access: 'protected', file: file('application/commands/issue-invoice/issue-invoice.handler') },
      ]);
    });

    it('finds the publishers of application/integration/publishers/, which are domain event handlers', () => {
      const description = createApplication({ modules: [kernelModule(), found.module] }).describe();

      expect(description.domainEventHandlers).toContainEqual({
        event: 'InvoiceIssued',
        name: 'billing.invoice.issued',
        handler: 'InvoiceIssuedPublisher',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'InvoiceIssuedPublisher',
        file: path.join(found.directory, `application/integration/publishers/invoice-issued.publisher${found.extension}`),
      });
    });

    it('names the class and the file when a check fails', async () => {
      const again = await discoverContext('invoicing', found.directory);
      const policy = path.join(found.directory, `application/authorization/only-issuer-voids.policy${found.extension}`);

      expect(() => createApplication({ modules: [kernelModule(), found.module, again] })).toThrow(
        `Token "OnlyIssuerVoids" is bound twice: by module "billing" (declared by class OnlyIssuerVoids in ${policy}) and by module "invoicing" (declared by class OnlyIssuerVoids in ${policy}).`,
      );
    });
  });
}

describeDiscovery('as the test runner loads its sources', async () => ({
  directory: path.join(FIXTURES, BILLING),
  extension: '.ts',
  billing: await import('./fixtures/contexts/billing/billing.declarations.js'),
}));

for (const mode of decoratorModes(FIXTURES)) {
  describeDiscovery(`compiled by ${mode.label}`, async () => {
    const directory = path.join(await mode.compile(), BILLING);
    const barrel = pathToFileURL(path.join(directory, 'billing.declarations.js')).href;

    return { directory, extension: '.js', billing: (await import(/* @vite-ignore */ barrel)) as Billing };
  });

  // The classes of the compiled context name the ports of the copy of the kernel they were
  // emitted next to: the application above resolved them from a container keyed by this one.
  describe(`the kernel a context compiled by ${mode.label} loads`, () => {
    let copy: Kernel;

    beforeAll(async () => {
      copy = (await mode.kernel()) as Kernel;
    }, 60_000);

    it('is another copy, whose ports are other classes and the same tokens', () => {
      expect(copy.Clock).not.toBe(Clock);
      expect(copy.CommandBus).not.toBe(CommandBus);
      expect(tokenIdentity(copy.Clock)).toBe(tokenIdentity(Clock));
      expect(tokenIdentity(copy.CommandBus)).toBe(tokenIdentity(CommandBus));
      expect(tokenIdentity(copy.IdGenerator)).not.toBe(tokenIdentity(Clock));
    });

    it('names ports this container binds, and fakes given under either copy stand for both', () => {
      const clock = new copy.FixedClock(new Date(0));
      const app = createApplication({ modules: [kernelModule({ clock })] });
      const faked = createTestApplication({ modules: [], fakes: [fake(copy.IdGenerator, { next: () => 'from-the-copy' })] });

      expect(app.resolve(copy.Clock)).toBe(clock);
      expect(app.resolve(Clock)).toBe(clock);
      expect(app.container.isRegistered(tokenIdentity(copy.Clock))).toBe(true);
      expect(faked.get(IdGenerator).next()).toBe('from-the-copy');
    });
  });
}
