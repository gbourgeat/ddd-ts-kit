import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write, type CliResult } from './helpers';
import { failure, report } from './reports';
import { jobProject } from './support/job-project';
import { STORY_SLICES } from './support/story-slices';

const BILLING = 'src/contexts/billing';
const CONFIG = 'ddd-ts-kit.config.json';
const CONTEXT_DOC = `${BILLING}/CONTEXT.md`;
const SUPPORT = 'test/e2e/support/start-application.ts';
const CANCEL_HANDLER = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const FIND_HANDLER = `${BILLING}/application/queries/find-invoices/find-invoices.handler.ts`;
const MARKER = "// TODO(domain): a policy refines billingPermissions['invoice.cancel']";

let root: string;

const generate = (...args: string[]): CliResult => cli(root, 'generate', ...args, '--json');

const refused = (...args: string[]): string => failure(generate(...args)).message;

/** The report of a command that must succeed; its error output is the message of a failure. */
const ok = (...args: string[]): ReturnType<typeof report> => {
  const result = generate(...args);

  expect(result.code, result.stderr || result.stdout).toBe(0);

  return report(result);
};

const notes = (...args: string[]): string => ok(...args).notes.join('\n');

function remove(file: string): void {
  fs.rmSync(path.join(root, file), { recursive: true, force: true });
}

function edit(file: string, change: (text: string) => string): void {
  write(root, file, change(read(root, file)));
}

beforeAll(() => {
  root = jobProject();

  expect(
    cli(
      root,
      'generate',
      'context',
      'shipping',
      '--classification',
      'supporting',
      '--upstream',
      'billing:customer-supplier',
      '--term',
      'Parcel=A package handed to a carrier',
    ).code,
  ).toBe(0);
});

describe('generate, what it refuses before writing', () => {
  it('a context upstream of itself, or with a relationship it does not know', () => {
    expect(refused('context', 'notices', '--classification', 'supporting', '--upstream', 'billing:bogus')).toBe(
      'Unknown relationship "bogus" in --upstream billing:bogus.',
    );

    expect(refused('context', 'notices', '--classification', 'supporting', '--upstream', 'notices')).toBe(
      'The context "notices" cannot be its own upstream.',
    );
  });

  it('an integration event version below one, and an event type that is not one of the upstream', () => {
    expect(refused('integration-event', 'billing', 'Invoice', 'Cancelled', '--version', '0')).toBe(
      '"0" is not a valid version.',
    );

    expect(refused('integration-handler', 'shipping', 'billing', 'bad-type')).toBe(
      '"bad-type" is not an event type of "billing".',
    );
  });

  it('a policy without a permission, or with one that is no permission name', () => {
    expect(refused('policy', 'billing', 'OnlyIssuerCancels')).toBe('A policy needs --permission.');

    expect(refused('policy', 'billing', 'OnlyIssuerCancels', '--permission', 'BadName')).toBe(
      '"BadName" is not a permission name.',
    );
  });

  it('a route told both --command and --query, or put behind a group whose file declares none', () => {
    const route = ['route', 'billing', 'CancelInvoice', '--method', 'DELETE', '--path', '/invoices/:invoiceId'];

    write(root, `${BILLING}/presentation/http/nope.routes.ts`, 'export class NopeRoutes {}\n');

    expect(refused(...route, '--command', '--query')).toBe('--command and --query exclude each other.');

    expect(refused(...route, '--group', 'Nope')).toBe(
      `${BILLING}/presentation/http/nope.routes.ts declares no route group.`,
    );
  });

  it('a decision record without a title, and a module named after a layout, a bag or an unknown classification', () => {
    expect(refused('adr', '')).toBe('A decision record needs a title.');
    expect(refused('module', 'billing', 'aggregates')).toBe('"aggregates" cannot name a module of the model.');
    expect(refused('module', 'billing', 'shared')).toContain('names a grouping of code ("shared")');
    expect(refused('module', 'billing', 'invoices', '--classification', 'odd')).toBe('Unknown classification "odd".');
  });
});

describe('generate, what it says of a project whose files are not as init wrote them', () => {
  it('names the context an anti-corruption layer translates when the relationship says otherwise', () => {
    expect(notes('acl', 'shipping', 'billing')).toContain(
      '"billing" is a context of this project: declare it in contexts.shipping.upstreams with the relationship "anti-corruption-layer".',
    );
  });

  it('writes the no-store cache policy of a controller, and leaves out a mapper of a search or a serializer of a command', () => {
    const cancel = ['route', 'billing', 'CancelInvoice', '--method', 'DELETE', '--path', '/invoices/:invoiceId'];

    ok(...cancel, '--cache', 'no-store');

    expect(read(root, `${BILLING}/presentation/http/invoices/cancel-invoice/cancel-invoice.controller.ts`)).toContain(
      'cache: { scope: CacheScope.noStore },',
    );

    ok(
      'query',
      'billing',
      'SearchInvoices',
      '--search',
      '--permission',
      'invoice.search',
      '--term',
      'Search=To find invoices',
    );

    expect(notes('route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices', '--mapper')).toContain(
      '--mapper is left out: the controller of a search hands the page over itself.',
    );

    expect(
      notes('route', 'billing', 'RemindInvoices', '--method', 'POST', '--path', '/reminders', '--serializer'),
    ).toContain('--serializer is left out: only the controller of a plain query has a result to serialize.');
  });

  it('names what already reacts to the birth event the end-to-end spec stops at, and writes no refusal case for a transition every state allows', () => {
    const terms = ['--term', 'Issue=To make an invoice final'];

    ok('aggregate', 'billing', 'Invoice', '--birth', 'Invoice Issued', ...terms);
    ok('event-handler', 'billing', 'Invoice', 'Issued');
    ok('command', 'billing', 'IssueInvoice', '--creates', '--aggregate', 'Invoice', '--permission', 'invoice.issue');
    ok('route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');

    expect(notes('e2e', 'billing', 'IssueInvoice')).toContain(
      'The trace the end-to-end spec expects stops at `domain-event` of InvoiceIssued: add under it the spans of what reacts to it (event-handlers/invoice-issued.event-handler.ts)',
    );

    const machine = ['state-machine', 'billing', 'Invoice', '--value', 'draft', '--value', 'issued'];

    ok(...machine, '--transition', 'annotate:draft,issued');
    expect(read(root, `${BILLING}/test/unit/invoice.state-machine.spec.ts`)).not.toContain('refuses annotate');
  });

  it('expects no birth event after the save of a handler that creates nothing', () => {
    const close = [
      'command',
      'billing',
      'CloseInvoice',
      '--creates',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.close',
    ];

    ok(...close, '--term', 'Close=To end an invoice');

    edit(`${BILLING}/application/commands/close-invoice/close-invoice.handler.ts`, (text) =>
      text.replace('Invoice.create(', 'Invoice.closed('),
    );

    ok('route', 'billing', 'CloseInvoice', '--method', 'POST', '--path', '/closed-invoices');
    ok('e2e', 'billing', 'CloseInvoice');

    const spec = read(root, 'test/e2e/close-invoice.e2e.spec.ts');

    expect(spec).toContain("{ name: 'repository InvoiceRepository.save' }]");
    expect(spec).not.toContain("'domain-event ");
  });
});

describe('generate, what it says of a project whose support files are missing or changed', () => {
  it('says the end-to-end support is missing, to an end-to-end spec and to an acceptance spec', () => {
    remove(SUPPORT);
    write(root, 'docs/architecture/slices.md', STORY_SLICES);

    expect(notes('e2e', 'billing', 'CancelInvoice')).toContain(`${SUPPORT} is missing`);
    expect(notes('acceptance', 'US1', 'Invoice a customer')).toContain(`${SUPPORT} is missing`);
  });

  it('writes no builder of an aggregate without create', () => {
    ok('aggregate', 'billing', 'Payment', '--term', 'Payment=Money received');
    edit(`${BILLING}/domain/aggregates/payment.aggregate.ts`, (text) => text.replace('static create(', 'static open('));

    expect(notes('builder', 'billing', 'Payment', '--force')).toContain(
      'has no `static create`, which the builder calls: no builder written.',
    );
  });

  it('writes the index of a published language that lost it, and the role vocabulary a grant needs', () => {
    remove(`${BILLING}/published-language/index.ts`);
    remove('src/platform/auth/authorization/role.ts');

    expect(ok('integration-event', 'billing', 'Invoice', 'Cancelled').created).toContain(
      `${BILLING}/published-language/index.ts`,
    );

    const notify = ['command', 'billing', 'NotifyCustomer', '--permission', 'invoice.notify', '--grant', 'accountant'];
    const terms = ['--term', 'Notify=To tell the customer', '--term', 'Customer=Who is invoiced'];

    expect(ok(...notify, ...terms).created).toContain('src/platform/auth/authorization/role.ts');
  });

  it('marks no handler it cannot read, and marks a search whose handler no longer names the permission', () => {
    const find = ['query', 'billing', 'FindInvoices', '--search', '--permission', 'invoice.cancel'];

    ok(...find, '--term', 'Find=To look for');
    write(root, `${BILLING}/application/commands/foo/foo.command.ts`, 'export const nothing = 1;\n');

    edit(CANCEL_HANDLER, (text) =>
      text.replace('async execute(command: CancelInvoiceCommand)', 'execute(command: CancelInvoiceCommand)'),
    );

    edit(FIND_HANDLER, (text) =>
      text.replace("billingPermissions['invoice.cancel']", "billingPermissions['invoice.search']"),
    );

    ok('policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');
    expect(read(root, CANCEL_HANDLER)).not.toContain(MARKER);
    expect(read(root, FIND_HANDLER)).toContain(MARKER);

    remove(`${BILLING}/application/commands/foo`);
  });
});

describe('generate, what it says of a project whose config and platform files are not as init wrote them', () => {
  it('grants a job everything when the permission of its command cannot be read', () => {
    edit(`${BILLING}/application/commands/cancel-invoice/cancel-invoice.command.ts`, (text) =>
      text.replace(/^@Requires\(.*\)\n/m, ''),
    );

    const job = ['job', 'billing', 'RemindOverdue', '--every', '1d', '--command', 'CancelInvoice'];

    ok(...job, '--term', 'Overdue=Past its due date');
    expect(read(root, `${BILLING}/test/unit/remind-overdue.job.spec.ts`)).toContain("holdersOf('*')");
  });

  it('declares no module in a config whose context is not written as an object', () => {
    const config = read(root, CONFIG);
    const parsed: unknown = JSON.parse(config);
    const contexts = typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'contexts') : undefined;

    write(
      root,
      CONFIG,
      JSON.stringify({ ...(parsed as object), contexts: { ...(contexts as object), billing: 'core' } }),
    );

    try {
      ok('module', 'billing', 'invoices');
      expect(JSON.parse(read(root, CONFIG))).toMatchObject({ contexts: { billing: 'core' } });
    } finally {
      write(root, CONFIG, config);
    }
  });

  it('leaves RUN_JOBS by hand when load-config.ts has no region for it', () => {
    edit('src/platform/config/load-config.ts', (text) =>
      text.replace('// ddd-ts-kit:run-jobs\n', '').replace('// /ddd-ts-kit:run-jobs\n', ''),
    );

    expect(notes('worker')).toContain('has no "ddd-ts-kit:run-jobs" region: make RUN_JOBS default to false by hand');
  });

  it('refuses a term when the CONTEXT.md has no glossary table to take it', () => {
    const doc = read(root, CONTEXT_DOC);

    write(root, CONTEXT_DOC, doc.replace('## Ubiquitous language', '## Vocabulary'));

    try {
      expect(refused('aggregate', 'billing', 'Receipt', '--term', 'Receipt=Proof of payment')).toBe(
        `${CONTEXT_DOC} has no "## Ubiquitous language" table to add the terms to.`,
      );
    } finally {
      write(root, CONTEXT_DOC, doc);
    }
  });

  it('writes the proof that each context wires alone when it is missing, and tells knip nothing when its file is', () => {
    remove('knip.json');
    remove('test/architecture/extractable.spec.ts');

    const { created } = ok('context', 'notices', '--classification', 'supporting', '--term', 'Notice=A message');

    expect(created).toContain('test/architecture/extractable.spec.ts');
    expect(exists(root, 'knip.json')).toBe(false);
  });
});
