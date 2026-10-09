import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine.js';
import { loadProject } from '../src/check/project.js';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';
const MODULE = `${BILLING}/billing.module.ts`;
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const CONSUMER = `${SHIPPING}/application/integration/consumers/invoice-cancelled.consumer.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/in-memory-invoice.repository.ts`;
const CONFIG = 'ddd-ts-kit.config.json';

const created: string[] = [];

afterAll(() => {
  for (const directory of created.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('governance/recorded-deviation', () => {
  const suppression = (reason: string): string => `// eslint-disable-next-line no-console -- ${reason}\nexport const repository = 1;\n`;

  it('accepts ADR-0007, ADR-7, ADR 7, adr7 and a path to the record, whatever the zero padding of the file', () => {
    for (const reference of ['ADR-0007: banner', 'see ADR-7', 'approved in ADR 7', 'adr7', 'docs/adr/007-banner.md']) {
      const root = projectWith({ [ADAPTER]: suppression(reference), 'docs/adr/007-banner.md': '# Banner\n' });

      expect(reported(root, 'governance/recorded-deviation'), reference).toEqual([]);
    }
  });

  it('refuses a reason without a record, and a record that is not on disk', () => {
    const unrecorded = projectWith({ [ADAPTER]: suppression('requested by operations') });
    const missing = projectWith({ [ADAPTER]: suppression('ADR-0008: requested by operations'), 'docs/adr/0007-banner.md': '# Banner\n' });

    expect(reported(unrecorded, 'governance/recorded-deviation')).toEqual([{ file: ADAPTER, line: 1, message: 'The suppression (eslint-disable-next-line) points to no decision record.' }]);
    expect(reported(missing, 'governance/recorded-deviation')[0]?.message).toContain('refers to ADR-8');
  });

  it('judges the suppressions of one file in check-file, and leaves the config to the full check', () => {
    const root = projectWith({ [ADAPTER]: suppression('requested by operations') }, { guard: 'off' });

    expect(reported(root, 'governance/recorded-deviation', ADAPTER).map(({ file }) => file)).toEqual([ADAPTER]);
    expect(reported(root, 'governance/recorded-deviation').map(({ file }) => file)).toEqual([CONFIG, ADAPTER]);
  });

  it('reports each relaxed setting on its own line of the config, until a deviation records it', () => {
    const relaxed = {
      rules: { 'tree/closed': 'off', 'naming/suffix': 'warn', 'test/no-mocks': 'error', 'clean/function-size': 'warn' },
      domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'],
      guard: 'advise',
    };
    const whats = ['rules.tree/closed', 'rules.naming/suffix', 'domainAllowedPackages.decimal.js', 'guard'];
    const deviations = whats.map((what) => ({ what, adr: '0004', reason: 'Recorded.' }));
    const bare = projectWith({}, relaxed);
    const recorded = projectWith({ 'docs/adr/0004-legacy-import.md': '# Legacy import\n' }, { ...relaxed, deviations });

    const found = reported(bare, 'governance/recorded-deviation');
    const lines = fs.readFileSync(path.join(bare, CONFIG), 'utf8').split('\n');

    expect(found.map(({ message }) => message.split(',')[0])).toEqual([
      'The rule "tree/closed" is lowered to "off"',
      'The rule "naming/suffix" is lowered to "warn"',
      'The package "decimal.js" is added to domainAllowedPackages',
      '"guard" is "advise": the editor hook no longer refuses a violation',
    ]);
    expect(found.map(({ line }) => lines[line - 1]?.trim())).toEqual(['"tree/closed": "off",', '"naming/suffix": "warn",', '"decimal.js"', '"guard": "advise"']);
    expect(reported(recorded, 'governance/recorded-deviation')).toEqual([]);
  });
});

describe('authz/declared', () => {
  const files = {
    [COMMAND]: 'export class IssueInvoiceCommand {}\n',
    [MODULE]: 'export const authorization = [];\n',
  };

  it('asks modules wired by hand for an authorization entry per use case, not modules wired by the container', () => {
    const manual = projectWith(files, { stack: { di: 'manual' } });
    const container = projectWith(files);

    expect(reported(manual, 'authz/declared')).toEqual([{ file: COMMAND, line: 1, message: 'The command IssueInvoiceCommand declares no permission and is not declared public.' }]);
    expect(reported(container, 'authz/declared')).toEqual([]);
  });

  it('does not judge a command alone in check-file, where the module is not loaded', () => {
    const manual = projectWith(files, { stack: { di: 'manual' } });

    expect(reported(manual, 'authz/declared', COMMAND)).toEqual([]);
  });

  it('reads the declaration in the chain of its own registration only', () => {
    const module = [
      'export function register(builder: Builder): void {',
      '  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [CLOCK])',
      '  builder',
      '    .query(ListInvoicesQuery)',
      "    .requires(billingPermissions['invoice.list'])",
      '    .handledBy(ListInvoicesHandler, []);',
      '}',
      '',
    ].join('\n');
    const root = projectWith({ [MODULE]: module });

    expect(reported(root, 'authz/declared', MODULE).map(({ line }) => line)).toEqual([2]);
  });
});

describe('events/consumer-idempotent', () => {
  const consumer = { [CONSUMER]: 'export class InvoiceCancelledConsumer {}\n' };
  const module = (registration: string): Record<string, string> => ({ [`${SHIPPING}/shipping.module.ts`]: `export function start(): void {\n  ${registration}\n}\n` });

  it('finds the consumer by its class, its instance or its token in a named registration', () => {
    const registrations = [
      "builder.on(invoiceCancelledV1, { consumer: 'shipping.invoice-cancelled' }).handledBy(InvoiceCancelledConsumer, [COMMAND_BUS]);",
      "subscribeAll(subscriber, [consume(invoiceCancelledV1, { consumer: 'shipping.invoice-cancelled', processed, unitOfWork }, (event) => invoiceCancelledConsumer.handle(event))]);",
      "subscriber.subscribe(InvoiceCancelledConsumer.eventType, idempotent('shipping.invoice-cancelled', store, (event) => resolve(INVOICE_CANCELLED_CONSUMER).handle(event)));",
    ];
    for (const registration of registrations) {
      expect(reported(projectWith({ ...consumer, ...module(registration) }), 'events/consumer-idempotent'), registration).toEqual([]);
    }
  });

  it('reports a consumer that is only bound, and says nothing about it in check-file', () => {
    const root = projectWith({ ...consumer, ...module("builder.bind(INVOICE_CANCELLED_CONSUMER).toClass(InvoiceCancelledConsumer, [COMMAND_BUS]).as('consumer');") });

    expect(reported(root, 'events/consumer-idempotent').map(({ file }) => file)).toEqual([CONSUMER]);
    expect(reported(root, 'events/consumer-idempotent', CONSUMER)).toEqual([]);
  });

  it('names the file that took a consumer name first', () => {
    const registration = "export const subscriptions = [consume(invoiceCancelledV1, { consumer: 'invoice-cancelled', processed, unitOfWork }, cancel)];\n";
    const root = projectWith({ [MODULE]: registration, [`${SHIPPING}/shipping.module.ts`]: registration });

    expect(reported(root, 'events/consumer-idempotent')).toEqual([
      { file: `${SHIPPING}/shipping.module.ts`, line: 1, message: `The consumer name "invoice-cancelled" is already used in ${MODULE}.` },
    ]);
  });
});

describe('events/outbox-required and context/extractable on the config', () => {
  it('asks for the outbox as soon as there is a database, unless a deviation says otherwise', () => {
    const stack = { orm: 'drizzle', events: 'in-memory' };
    const deviations = [{ what: 'stack.events', adr: '0001', reason: 'Events are advisory in this prototype.' }];

    expect(reported(projectWith({}, { stack }), 'events/outbox-required').map(({ file }) => file)).toEqual([CONFIG]);
    expect(reported(projectWith({}, { stack, deviations }), 'events/outbox-required')).toEqual([]);
    expect(reported(projectWith({}, { stack: { orm: 'none', database: 'none', events: 'in-memory' } }), 'events/outbox-required')).toEqual([]);
  });

  it('asks a deployable context for its entry point', () => {
    const contexts = { billing: { classification: 'core', upstreams: [], deployable: true }, shipping: { classification: 'supporting', upstreams: [] } };
    const without = projectWith({}, { contexts });
    const withEntryPoint = projectWith({ 'src/apps/billing/main.ts': 'export const composed = [];\n' }, { contexts });

    expect(reported(without, 'context/extractable')[0]?.message).toBe('The context "billing" is declared deployable but src/apps/billing/main.ts does not exist.');
    expect(reported(withEntryPoint, 'context/extractable')).toEqual([]);
  });
});

function projectWith(files: Readonly<Record<string, string>>, config: Record<string, unknown> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-deviations-'));
  created.push(root);
  const contexts = { billing: { classification: 'core', upstreams: [] }, shipping: { classification: 'supporting', upstreams: ['billing'] } };
  const written = { [CONFIG]: JSON.stringify({ contexts, ...config }, null, 2), ...files };
  for (const [file, content] of Object.entries(written)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

interface Reported {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

function reported(root: string, rule: string, onlyFile?: string): Reported[] {
  const project = onlyFile === undefined ? loadProject(root) : loadProject(root, { onlyFile });
  return runCheck(project, { rules: [rule], fileScopeOnly: onlyFile !== undefined }).violations.map(({ file, line, message }) => ({ file, line, message }));
}
