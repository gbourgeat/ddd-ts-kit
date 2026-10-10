import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApplication, kernelModule } from '../src/index.js';
import { discoverContext } from '../src/discovery.js';
import { InvoiceIssuedPublisher } from './fixtures/contexts/billing/application/integration/publishers/invoice-issued.publisher.js';
import { IssueMonthlyInvoicesJob } from './fixtures/contexts/billing/application/scheduling/issue-monthly-invoices.job.js';
import { InMemoryInvoiceRepository } from './fixtures/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';
import { wiringRejection } from './support/rejection.js';

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
    const directory = contextWith({ [HANDLER]: 'export class Plain {}', 'infrastructure/external/legacy.adapter.mjs': 'export class Plain {}' });

    const module = await discoverContext('billing', directory, { ignore: (file) => file.includes('legacy') || file.endsWith('.handler.mjs') });

    expect(createApplication({ modules: [module] }).describe().bindings).toEqual([]);
  });

  it('says which file failed to load, and keeps why', async () => {
    const directory = contextWith({ [HANDLER]: "throw new Error('the database driver is missing');" });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('DISCOVERY_FAILED');
    expect(failure.message).toBe(`${path.join(directory, HANDLER)} could not be loaded: the database driver is missing`);
    expect(failure.cause).toBeInstanceOf(Error);
  });

  it('refuses a role file that declares nothing', async () => {
    const directory = contextWith({ [HANDLER]: 'export class IssueInvoiceHandler {}\nexport const answer = 42;' });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('NOTHING_DECLARED');
    expect(failure.message).toContain(`${path.join(directory, HANDLER)} of context "billing" is a *.handler file and exports no class that declares itself.`);
  });

  it('refuses a role file outside its canonical folder, before loading it', async () => {
    const directory = contextWith({ 'infrastructure/external/issue-invoice.handler.mjs': "throw new Error('never loaded');" });

    const failure = await wiringRejection(discoverContext('billing', directory));

    expect(failure.code).toBe('MISPLACED_DECLARATION');

    expect(failure.message).toBe(
      'infrastructure/external/issue-invoice.handler.mjs of context "billing" is outside its canonical folder: a *.handler file belongs in application/commands/ or application/queries/.',
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
    expect(failure.message).toContain('holds neither application/ nor infrastructure/');
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
      message: 'application/commands/issue-monthly-invoices.job.mjs of context "billing" is outside its canonical folder: a *.job file belongs in application/scheduling/.',
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
      `${misplaced} of context "billing" is outside its canonical folder: a *.publisher file belongs in application/integration/publishers/.`,
    );
  });
});
