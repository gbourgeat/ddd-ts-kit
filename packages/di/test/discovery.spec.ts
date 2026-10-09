import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { WiringError, createApplication, createTestApplication, kernelModule, type ContextModule } from '../src/index.js';
import { discoverContext } from '../src/discovery.js';
import { InMemoryInvoiceRepository } from './fixtures/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';
import { decoratorModes, removeCompiled } from './support/decorator-modes.js';

type Billing = typeof import('./fixtures/contexts/billing/billing.declarations.js');

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const BILLING = 'contexts/billing';
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const workspace = mkdtempSync(path.join(os.tmpdir(), 'discovery-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
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
      const { IssueInvoice, GetInvoice, CUSTOMERS } = found.billing;
      const app = createTestApplication({ modules: [found.module], fakes: [[CUSTOMERS, { exists: async () => true }]] });
      await app.start();

      const invoiceId = await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'));

      expect(await app.queryBus.execute(new GetInvoice(invoiceId))).toMatchObject({ customerId: 'customer-1' });
      expect(app.eventBus.published).toHaveLength(1);
    });

    it('wires what it found in the order of the paths, whatever the disk answers first', () => {
      const description = createApplication({ modules: [kernelModule(), found.module] }).describe();
      const declared = description.bindings.filter((binding) => binding.module === 'billing');

      expect(declared.map((binding) => binding.implementation)).toEqual([
        'OnlyIssuerVoids',
        'IssueInvoiceHandler',
        'InvoiceIssuedEventHandler',
        'InvoiceOnOrderPlaced',
        'GetInvoiceHandler',
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
          token: 'billing.InvoiceRepository',
          origin: 'declared',
          declaredBy: 'InMemoryInvoiceRepository',
          file: file('infrastructure/persistence/in-memory-invoice.repository'),
        }),
      );
      expect(description.commands).toMatchObject([
        { message: 'IssueInvoice', access: 'protected', file: file('application/commands/issue-invoice/issue-invoice.handler') },
      ]);
    });

    it('names the class and the file when a check fails', async () => {
      const again = await discoverContext('invoicing', found.directory);

      expect(() => createApplication({ modules: [kernelModule(), found.module, again] })).toThrow(
        `"IssueInvoiceHandler" in module "invoicing" (declared by class IssueInvoiceHandler in ${path.join(found.directory, 'application/commands/issue-invoice/issue-invoice.handler')}${found.extension})`,
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
}

/** A context directory on disk, written for one spec: paths relative to it, with their text. */
function contextWith(files: Readonly<Record<string, string>>): string {
  const directory = mkdtempSync(path.join(workspace, 'context-'));
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    writeFileSync(path.join(directory, relative), text);
  }
  return directory;
}

async function failureOf(work: Promise<unknown>): Promise<WiringError> {
  const outcome = await work.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(outcome instanceof WiringError)) throw new Error(`Expected a WiringError, got ${String(outcome)}`);
  return outcome;
}

const HANDLER = 'application/commands/issue-invoice/issue-invoice.handler.mjs';
const declaredRepository = async (): Promise<unknown> => ({ InMemoryInvoiceRepository, somethingElse: 42 });

describe('discovery', () => {
  it('loads only the role files of application/ and infrastructure/', async () => {
    const loaded: string[] = [];
    const directory = contextWith({
      'infrastructure/persistence/in-memory-invoice.repository.mjs': '',
      'infrastructure/persistence/in-memory-invoice.repository.d.ts': '',
      'infrastructure/persistence/invoice.mapper.mjs': '',
      'domain/repositories/invoice.repository.mjs': '',
      'presentation/http/invoice.handler.mjs': '',
      'test/unit/issue-invoice.handler.spec.mjs': '',
    });

    await discoverContext('billing', directory, {
      load: async (file) => {
        loaded.push(path.relative(directory, file.pathname));
        return declaredRepository();
      },
    });

    expect(loaded).toEqual(['infrastructure/persistence/in-memory-invoice.repository.mjs']);
  });

  it('loads a file once when it exists compiled and as a source, the compiled one by default', async () => {
    const loaded: string[] = [];
    const load = async (file: URL): Promise<unknown> => {
      loaded.push(path.extname(file.pathname));
      return declaredRepository();
    };
    const directory = contextWith({
      'infrastructure/persistence/in-memory-invoice.repository.ts': '',
      'infrastructure/persistence/in-memory-invoice.repository.js': '',
    });

    await discoverContext('billing', directory, { load });
    await discoverContext('billing', directory, { load, extensions: ['.ts', '.js'] });
    await discoverContext('billing', directory, { load, extensions: ['.ts'] });

    expect(loaded).toEqual(['.js', '.ts', '.ts']);
  });

  it('leaves out what the project ignores', async () => {
    const directory = contextWith({ [HANDLER]: 'export class Plain {}', 'infrastructure/external/legacy.adapter.mjs': 'export class Plain {}' });

    const module = await discoverContext('billing', directory, { ignore: (file) => file.includes('legacy') || file.endsWith('.handler.mjs') });

    expect(createApplication({ modules: [module] }).describe().bindings).toEqual([]);
  });

  it('says which file failed to load, and keeps why', async () => {
    const directory = contextWith({ [HANDLER]: "throw new Error('the database driver is missing');" });

    const failure = await failureOf(discoverContext('billing', directory));

    expect(failure.code).toBe('DISCOVERY_FAILED');
    expect(failure.message).toBe(`${path.join(directory, HANDLER)} could not be loaded: the database driver is missing`);
    expect(failure.cause).toBeInstanceOf(Error);
  });

  it('refuses a role file that declares nothing', async () => {
    const directory = contextWith({ [HANDLER]: 'export class IssueInvoiceHandler {}\nexport const answer = 42;' });

    const failure = await failureOf(discoverContext('billing', directory));

    expect(failure.code).toBe('NOTHING_DECLARED');
    expect(failure.message).toContain(`${path.join(directory, HANDLER)} of context "billing" is a *.handler file and exports no class that declares itself.`);
  });

  it('refuses a role file outside its canonical folder, before loading it', async () => {
    const directory = contextWith({ 'infrastructure/external/issue-invoice.handler.mjs': "throw new Error('never loaded');" });

    const failure = await failureOf(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');
    expect(failure.message).toBe(
      'infrastructure/external/issue-invoice.handler.mjs of context "billing" is outside its canonical folder: a *.handler file belongs in application/commands/ or application/queries/.',
    );
  });

  it('refuses a class that declares another role than the one of its file', async () => {
    const directory = contextWith({ [HANDLER]: '' });

    const failure = await failureOf(discoverContext('billing', directory, { load: declaredRepository }));

    expect(failure.code).toBe('MISPLACED_DECLARATION');
    expect(failure.message).toContain('Class InMemoryInvoiceRepository declares itself as repository in');
    expect(failure.message).toContain('a *.handler file: that suffix is for command-handler or query-handler.');
  });

  it('refuses a directory that is not a bounded context', async () => {
    const failure = await failureOf(discoverContext('billing', contextWith({ 'notes/readme.mjs': '' })));

    expect(failure.code).toBe('DISCOVERY_FAILED');
    expect(failure.message).toContain('holds neither application/ nor infrastructure/');
  });
});
