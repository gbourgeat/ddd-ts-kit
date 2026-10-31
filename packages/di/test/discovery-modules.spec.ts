import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { fake } from '../src';
import { createTestApplication } from './support/on-container';
import { discoverContext } from '../src/discovery';
import './fixtures/contexts/billing/billing.dependencies';
import { IssueInvoice } from './fixtures/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
import { IssueInvoiceHandler } from './fixtures/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';
import { CustomerDirectory } from './fixtures/contexts/billing/application/ports/customer-directory.port';
import { InMemoryInvoiceRepository } from './fixtures/contexts/billing/infrastructure/persistence/in-memory-invoice.repository';
import { wiringRejection } from './support/rejection';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'discovery-modules-'));

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

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

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

  it('reads the modules laid out under application/ as 0.86 and 0.87 did, each as the module it names', async () => {
    const UNDER_APPLICATION = 'application/invoicing/commands/issue-invoice';

    const classes: Readonly<Record<string, unknown>> = {
      [`${UNDER_APPLICATION}/issue-invoice.command.mjs`]: { IssueInvoice },
      [`${UNDER_APPLICATION}/issue-invoice.handler.mjs`]: { IssueInvoiceHandler },
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
    expect(app.describe().commands).toMatchObject([{ message: 'IssueInvoice' }]);
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
