import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { createApplication, createTestApplication, fake, kernelModule } from '../src';
import { discoverContext } from '../src/discovery';
// What `ddd-ts-kit docs` generates next to the role files of a discovered context: here the stubbed loader answers the classes themselves, so their lists are registered the same way.
import './fixtures/contexts/billing/billing.dependencies';
import { InvoiceIssuedPublisher } from './fixtures/contexts/billing/application/integration/publishers/invoice-issued.publisher';
import { IssueInvoice } from './fixtures/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
import { IssueInvoiceHandler } from './fixtures/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';
import { CustomerDirectory } from './fixtures/contexts/billing/application/ports/customer-directory.port';
import { IssueMonthlyInvoicesJob } from './fixtures/contexts/billing/application/scheduling/issue-monthly-invoices.job';
import { InMemoryInvoiceRepository } from './fixtures/contexts/billing/infrastructure/persistence/in-memory-invoice.repository';
import { wiringRejection } from './support/rejection';
import { CompileStatementsJob } from './support/compile-statements.background-job';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'discovery-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** A context directory on disk, written for one spec: paths relative to it, with their text. */
function contextWith(files: Readonly<Record<string, string>>): string {
  const directory = mkdtempSync(path.join(workspace, 'context-'));

  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    writeFileSync(path.join(directory, relative), text);
  }

  return directory;
}

const HANDLER = 'application/commands/issue-invoice/issue-invoice.handler.mjs';
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const declaredRepository = async (): Promise<unknown> => ({ InMemoryInvoiceRepository, somethingElse: 42 });

describe('discovery', () => {
  it('loads only the role files of application/ and infrastructure/', async () => {
    const loaded: string[] = [];

    const directory = contextWith({
      'infrastructure/persistence/in-memory-invoice.repository.mjs': '',
      'infrastructure/persistence/in-memory-invoice.repository.d.ts': '',
      'infrastructure/persistence/invoice.mapper.mjs': '',
      'application/ports/mailer.port.mjs': '',
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
    const directory = contextWith({
      [HANDLER]: 'export class Plain {}',
      'infrastructure/external/legacy.adapter.mjs': 'export class Plain {}',
    });

    const module = await discoverContext('billing', directory, {
      ignore: (file) => file.includes('legacy') || file.endsWith('.handler.mjs'),
    });

    expect(createApplication({ modules: [module] }).describe().bindings).toEqual([]);
  });

  it('says which file failed to load, and keeps why', async () => {
    const directory = contextWith({ [HANDLER]: "throw new Error('the database driver is missing');" });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('DISCOVERY_FAILED');

    expect(failure.message).toBe(
      `${path.join(directory, HANDLER)} could not be loaded: the database driver is missing`,
    );

    expect(failure.cause).toBeInstanceOf(Error);
  });

  it('refuses a role file that declares nothing', async () => {
    const directory = contextWith({ [HANDLER]: 'export class IssueInvoiceHandler {}\nexport const answer = 42;' });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('NOTHING_DECLARED');

    expect(failure.message).toContain(
      `${path.join(directory, HANDLER)} of context "billing" is a *.handler file and exports no class that declares itself.`,
    );
  });

  it('refuses a role file outside its canonical folder, before loading it', async () => {
    const directory = contextWith({
      'infrastructure/external/issue-invoice.handler.mjs': "throw new Error('never loaded');",
    });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');

    expect(failure.message).toBe(
      'infrastructure/external/issue-invoice.handler.mjs of context "billing" is outside its canonical folder: a *.handler file belongs in application/commands/ or application/queries/, at the level of the context or in a module of its model (<module>/application/...) named in the generated <context>.dependencies file.',
    );
  });

  it('refuses a class that declares another role than the one of its file', async () => {
    const directory = contextWith({ [HANDLER]: '' });

    const failure = await wiringRejection(discoverContext('billing', directory, { load: declaredRepository }));

    expect(failure.code).toBe('MISPLACED_DECLARATION');
    expect(failure.message).toContain('Class InMemoryInvoiceRepository declares itself as repository in');
    expect(failure.message).toContain('a *.handler file: that suffix is for command-handler or query-handler.');
  });

  it('refuses a directory that is not a bounded context', async () => {
    const failure = await wiringRejection(discoverContext('billing', contextWith({ 'notes/readme.mjs': '' })));

    expect(failure.code).toBe('DISCOVERY_FAILED');
    expect(failure.message).toContain('holds no layer of a bounded context (application/, infrastructure/, domain/, ');
  });

  it('discovers a context that was just declared as an empty one: its published language is there, no role yet', async () => {
    const module = await discoverContext('billing', contextWith({ 'published-language/index.mjs': '' }));

    expect(module.name).toBe('billing');
    expect(() => createApplication({ modules: [kernelModule(), module] })).not.toThrow();
  });
});

describe('a discovered job', () => {
  const JOB = 'application/scheduling/issue-monthly-invoices.job.mjs';

  it('is a *.job file of application/scheduling/', async () => {
    const directory = contextWith({ [JOB]: '' });

    const module = await discoverContext('billing', directory, { load: async () => ({ IssueMonthlyInvoicesJob }) });

    expect(createApplication({ modules: [kernelModule(), module] }).describe().jobs).toMatchObject([
      { name: 'billing.issue-monthly-invoices', file: path.join(directory, JOB) },
    ]);
  });

  it('is refused outside its folder, and so is another role in a *.job file', async () => {
    const elsewhere = contextWith({ 'application/commands/issue-monthly-invoices.job.mjs': '' });
    const misplaced = await wiringRejection(discoverContext('billing', elsewhere));

    const wrongRole = await wiringRejection(
      discoverContext('billing', contextWith({ [JOB]: '' }), { load: async () => ({ InMemoryInvoiceRepository }) }),
    );

    expect(misplaced).toMatchObject({
      code: 'MISPLACED_DECLARATION',
      message:
        'application/commands/issue-monthly-invoices.job.mjs of context "billing" is outside its canonical folder: a *.job file belongs in application/scheduling/, at the level of the context or in a module of its model (<module>/application/...) named in the generated <context>.dependencies file.',
    });

    expect(wrongRole.code).toBe('MISPLACED_DECLARATION');
    expect(wrongRole.message).toContain('a *.job file: that suffix is for job.');
  });
});

describe('a discovered publisher', () => {
  const PUBLISHER = 'application/integration/publishers/invoice-issued.publisher.mjs';

  it('is a *.publisher file of application/integration/publishers/, holding a domain event handler', async () => {
    const directory = contextWith({ [PUBLISHER]: '' });

    const module = await discoverContext('billing', directory, { load: async () => ({ InvoiceIssuedPublisher }) });

    expect(createApplication({ modules: [kernelModule(), module] }).describe().domainEventHandlers).toEqual([
      {
        event: 'InvoiceIssued',
        name: 'billing.invoice.issued',
        phase: 'before-commit',
        handler: 'InvoiceIssuedPublisher',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'InvoiceIssuedPublisher',
        file: path.join(directory, PUBLISHER),
      },
    ]);
  });

  it('refuses another role in a *.publisher file', async () => {
    const directory = contextWith({ [PUBLISHER]: '' });

    const failure = await wiringRejection(discoverContext('billing', directory, { load: declaredRepository }));

    expect(failure.code).toBe('MISPLACED_DECLARATION');

    expect(failure.message).toBe(
      `Class InMemoryInvoiceRepository declares itself as repository in ${path.join(directory, PUBLISHER)}, a *.publisher file: that suffix is for domain-event-handler.`,
    );
  });

  it.each([
    'application/event-handlers/invoice-issued.publisher.mjs',
    'application/integration/handlers/invoice-issued.publisher.mjs',
    'infrastructure/external/invoice-issued.publisher.mjs',
  ])('refuses %s, outside its folder, before loading it', async (misplaced) => {
    const directory = contextWith({ [misplaced]: "throw new Error('never loaded');" });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');

    expect(failure.message).toBe(
      `${misplaced} of context "billing" is outside its canonical folder: a *.publisher file belongs in application/integration/publishers/, at the level of the context or in a module of its model (<module>/application/...) named in the generated <context>.dependencies file.`,
    );
  });
});

describe('discovery of a context divided into modules of its model', () => {
  const IN_MODULE = 'invoicing/application/commands/issue-invoice';

  it('finds the role files of a module the generated dependencies file names, without the config', async () => {
    const classes: Readonly<Record<string, unknown>> = {
      [`${IN_MODULE}/issue-invoice.command.mjs`]: { IssueInvoice },
      [`${IN_MODULE}/issue-invoice.handler.mjs`]: { IssueInvoiceHandler },
      'infrastructure/persistence/in-memory-invoice.repository.mjs': { InMemoryInvoiceRepository },
    };

    const directory = contextWith({
      ...Object.fromEntries(Object.keys(classes).map((file) => [file, ''])),
      'billing.dependencies.mjs': "export const modules = ['invoicing'];\n",
    });

    const module = await discoverContext('billing', directory, {
      load: async (file) => classes[path.relative(directory, file.pathname)],
    });

    const app = createTestApplication({
      modules: [module],
      fakes: [fake(CustomerDirectory, { exists: async () => true })],
    });

    await app.start();

    expect(await app.commandBus.execute(new IssueInvoice(ada, 'customer-1'))).toEqual(expect.any(String));

    expect(app.describe().commands).toMatchObject([
      { message: 'IssueInvoice', file: path.join(directory, `${IN_MODULE}/issue-invoice.handler.mjs`) },
    ]);
  });

  it('reads the modules as a bundler rewrites the generated file: double quotes, no spaces', async () => {
    const classes: Readonly<Record<string, unknown>> = {
      [`${IN_MODULE}/issue-invoice.command.mjs`]: { IssueInvoice },
      [`${IN_MODULE}/issue-invoice.handler.mjs`]: { IssueInvoiceHandler },
      'infrastructure/persistence/in-memory-invoice.repository.mjs': { InMemoryInvoiceRepository },
    };

    const directory = contextWith({
      ...Object.fromEntries(Object.keys(classes).map((file) => [file, ''])),
      'billing.dependencies.mjs': 'export const modules=["invoicing"];\n',
    });

    const module = await discoverContext('billing', directory, {
      load: async (file) => classes[path.relative(directory, file.pathname)],
    });

    const app = createTestApplication({
      modules: [module],
      fakes: [fake(CustomerDirectory, { exists: async () => true })],
    });

    await app.start();

    expect(app.describe().commands).toMatchObject([{ message: 'IssueInvoice' }]);
  });

  it('refuses a role file in the wrong role folder of a module, and says where it belongs', async () => {
    const misplaced = 'invoicing/application/ports/issue-invoice.handler.mjs';

    const directory = contextWith({
      [misplaced]: "throw new Error('never loaded');",
      'billing.dependencies.mjs': "export const modules = ['invoicing'];\n",
    });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');
    expect(failure.message).toContain('<module>/application/');
  });

  it('reads no folder as a module that the dependencies file does not name: check reports it, discovery does not wire it', async () => {
    const directory = contextWith({ [`${IN_MODULE}/issue-invoice.handler.mjs`]: "throw new Error('never loaded');" });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');
    expect(failure.message).toContain(`${IN_MODULE}/issue-invoice.handler.mjs`);
  });
});

describe('discovery of background jobs', () => {
  it('loads the background jobs of application/background/', async () => {
    const loaded: string[] = [];

    const directory = contextWith({
      'application/background/compile-statements.background-job.mjs': '',
      'application/background/notes.md': '',
    });

    await discoverContext('billing', directory, {
      load: async (file) => {
        loaded.push(path.relative(directory, file.pathname));

        return { CompileStatementsJob };
      },
    });

    expect(loaded).toEqual(['application/background/compile-statements.background-job.mjs']);
  });
});
