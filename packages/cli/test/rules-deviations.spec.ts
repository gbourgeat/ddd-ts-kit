import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { parseConfig, serializeConfig } from '../src/config';
import { projectWith, reported } from './rules-support';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';
const MODULE = `${BILLING}/billing.module.ts`;
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const INTEGRATION_HANDLER = `${SHIPPING}/application/integration/handlers/invoice-cancelled.integration-handler.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/in-memory-invoice.repository.ts`;
const CONFIG = 'ddd-ts-kit.config.json';

describe('governance/recorded-deviation', () => {
  const suppression = (reason: string): string =>
    `// eslint-disable-next-line no-console -- ${reason}\nexport const repository = 1;\n`;

  it('accepts ADR-0007, ADR-7, ADR 7, adr7 and a path to the record, whatever the zero padding of the file', () => {
    for (const reference of ['ADR-0007: banner', 'see ADR-7', 'approved in ADR 7', 'adr7', 'docs/adr/007-banner.md']) {
      const root = projectWith({ [ADAPTER]: suppression(reference), 'docs/adr/007-banner.md': '# Banner\n' });

      expect(reported(root, 'governance/recorded-deviation'), reference).toEqual([]);
    }
  });

  it('refuses a reason without a record, and a record that is not on disk', () => {
    const unrecorded = projectWith({ [ADAPTER]: suppression('requested by operations') });

    const missing = projectWith({
      [ADAPTER]: suppression('ADR-0008: requested by operations'),
      'docs/adr/0007-banner.md': '# Banner\n',
    });

    expect(reported(unrecorded, 'governance/recorded-deviation')).toEqual([
      { file: ADAPTER, line: 1, message: 'The suppression (eslint-disable-next-line) points to no decision record.' },
    ]);

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

    expect(found.map(({ line }) => lines[line - 1]?.trim())).toEqual([
      '"tree/closed": "off",',
      '"naming/suffix": "warn",',
      '"decimal.js"',
      '"guard": "advise"',
    ]);

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

    expect(reported(manual, 'authz/declared')).toEqual([
      {
        file: COMMAND,
        line: 1,
        message: 'The command IssueInvoiceCommand declares no permission and is not declared public.',
      },
    ]);

    expect(reported(container, 'authz/declared')).toEqual([]);
  });

  it('does not judge a command alone in check-file, where the module is not loaded', () => {
    const manual = projectWith(files, { stack: { di: 'manual' } });

    expect(reported(manual, 'authz/declared', COMMAND)).toEqual([]);
  });

  it('reads the declaration in the chain of its own registration only', () => {
    const module = [
      'export function register(builder: Builder): void {',
      '  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [Clock])',
      '  builder',
      '    .query(SearchInvoicesQuery)',
      "    .requires(billingPermissions['invoice.search'])",
      '    .handledBy(SearchInvoicesHandler, []);',
      '}',
      '',
    ].join('\n');

    const root = projectWith({ [MODULE]: module });

    expect(reported(root, 'authz/declared', MODULE).map(({ line }) => line)).toEqual([2]);
  });
});

describe('events/consumer-idempotent', () => {
  const handler = { [INTEGRATION_HANDLER]: 'export class InvoiceCancelledHandler {}\n' };

  const module = (registration: string): Record<string, string> => ({
    [`${SHIPPING}/shipping.module.ts`]: `export function start(): void {\n  ${registration}\n}\n`,
  });

  it('finds the integration event handler by its class or its instance in a named registration', () => {
    const registrations = [
      "builder.on(invoiceCancelledV1, { consumer: 'shipping.invoice-cancelled' }).handledBy(InvoiceCancelledHandler, [CommandBus]);",
      "subscribeAll(subscriber, [consume(invoiceCancelledV1, { consumer: 'shipping.invoice-cancelled', processed, unitOfWork }, (event) => invoiceCancelledHandler.handle(event))]);",
      "subscriber.subscribe(InvoiceCancelledHandler.eventType, idempotent('shipping.invoice-cancelled', store, (event) => resolve(InvoiceCancelledHandler).handle(event)));",
    ];

    for (const registration of registrations) {
      expect(
        reported(projectWith({ ...handler, ...module(registration) }), 'events/consumer-idempotent'),
        registration,
      ).toEqual([]);
    }
  });

  it('reports an integration event handler that is only bound, and says nothing about it in check-file', () => {
    const root = projectWith({
      ...handler,
      ...module("builder.bind(InvoiceCancelledHandler).toClass(InvoiceCancelledHandler, [CommandBus]).as('consumer');"),
    });

    expect(reported(root, 'events/consumer-idempotent').map(({ file }) => file)).toEqual([INTEGRATION_HANDLER]);
    expect(reported(root, 'events/consumer-idempotent', INTEGRATION_HANDLER)).toEqual([]);
  });

  it('names the file that took a consumer name first', () => {
    const registration =
      "export const subscriptions = [consume(invoiceCancelledV1, { consumer: 'invoice-cancelled', processed, unitOfWork }, cancel)];\n";

    const root = projectWith({ [MODULE]: registration, [`${SHIPPING}/shipping.module.ts`]: registration });

    expect(reported(root, 'events/consumer-idempotent')).toEqual([
      {
        file: `${SHIPPING}/shipping.module.ts`,
        line: 1,
        message: `The consumer name "invoice-cancelled" is already used in ${MODULE}.`,
      },
    ]);
  });
});

describe('events/outbox-required and context/extractable on the config', () => {
  it('asks for the outbox as soon as there is a database, unless a deviation says otherwise', () => {
    const stack = { orm: 'drizzle', events: 'in-memory' };
    const deviations = [{ what: 'stack.events', adr: '0001', reason: 'Events are advisory in this prototype.' }];

    expect(reported(projectWith({}, { stack }), 'events/outbox-required').map(({ file }) => file)).toEqual([CONFIG]);
    expect(reported(projectWith({}, { stack, deviations }), 'events/outbox-required')).toEqual([]);

    expect(
      reported(
        projectWith({}, { stack: { orm: 'none', database: 'none', events: 'in-memory' } }),
        'events/outbox-required',
      ),
    ).toEqual([]);
  });

  it('asks a deployable context for its entry point', () => {
    const contexts = {
      billing: { classification: 'core', upstreams: [], deployable: true },
      shipping: { classification: 'supporting', upstreams: [] },
    };

    const without = projectWith({}, { contexts });
    const withEntryPoint = projectWith({ 'src/apps/billing/main.ts': 'export const composed = [];\n' }, { contexts });

    expect(reported(without, 'context/extractable')[0]?.message).toBe(
      'The context "billing" is declared deployable but src/apps/billing/main.ts does not exist.',
    );

    expect(reported(withEntryPoint, 'context/extractable')).toEqual([]);
  });
});

describe('aspects, outside packages and standard interfaces', () => {
  const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
  const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
  const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
  const DECORATORS = "import { Retry } from '@ddd-ts-kit/aspects/decorators';\nexport { Retry };\n";

  it('reports an aspect decorator once: the layer rule inside the model and the use cases, aspects/outside-in around them', () => {
    const root = projectWith({
      [AGGREGATE]: DECORATORS,
      [HANDLER]: DECORATORS,
      [ROUTE]: DECORATORS,
      [ADAPTER]: DECORATORS,
      'src/platform/client.ts': DECORATORS,
      'src/main.ts': DECORATORS,
    });

    expect(reported(root, 'aspects/outside-in').map(({ file }) => file)).toEqual([ROUTE, 'src/main.ts']);
    expect(reported(root, 'layer/domain-purity').map(({ file }) => file)).toEqual([AGGREGATE]);
    expect(reported(root, 'layer/application-inward').map(({ file }) => file)).toEqual([HANDLER]);
  });

  it('says where each outside concern belongs, whatever the allow-list holds', () => {
    const imports = [
      "import { retry } from '@ddd-ts-kit/aspects';",
      "import { record } from '@ddd-ts-kit/audit/drizzle';",
      "import { RedisCache } from '@ddd-ts-kit/redis';",
      "import { withSpan } from '@ddd-ts-kit/tracing/node';",
      "import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';",
      "import { SentryErrorReporter } from '@ddd-ts-kit/sentry';",
    ];

    const allowed = [
      '@ddd-ts-kit/kernel',
      '@ddd-ts-kit/aspects',
      '@ddd-ts-kit/audit',
      '@ddd-ts-kit/redis',
      '@ddd-ts-kit/tracing',
      '@ddd-ts-kit/scheduling',
      '@ddd-ts-kit/sentry',
    ];

    const root = projectWith({ [HANDLER]: `${imports.join('\n')}\n` }, { applicationAllowedPackages: allowed });

    const found = runCheck(loadProject(root), { rules: ['layer/application-inward'] }).violations;

    expect(found.map(({ line }) => line)).toEqual([1, 2, 3, 4, 5, 6]);

    expect(found.map(({ message }) => message.split(':')[0])).toEqual(
      imports.map((line) => `The application layer imports "${/'(.+)'/.exec(line)?.[1] ?? ''}"`),
    );

    expect(found.map(({ fix }) => fix)).toEqual([
      expect.stringContaining('`.with(...)`'),
      expect.stringContaining('bus middleware'),
      expect.stringContaining('`Cache` of @ddd-ts-kit/kernel'),
      expect.stringContaining('`traceApplication()`'),
      expect.stringContaining('`JobScheduler` port'),
      expect.stringContaining('`ErrorReporter` port'),
    ]);
  });

  it('reads the names of standard/no-parallel-interface from the config over the defaults', () => {
    const source =
      'export interface ILogger {}\nexport type CurrentUser = { id: string };\nexport class TenantInfo {}\nexport class CacheService implements Cache {}\nimport { type IClock } from "./clock.js";\n';

    const defaults = projectWith({ 'src/platform/shapes.ts': source });

    const configured = projectWith(
      { 'src/platform/shapes.ts': source },
      { standardInterfaces: { CurrentUser: false, TenantInfo: 'TenantScoped', ILogger: 'Logger (see ADR-0003)' } },
    );

    expect(
      reported(defaults, 'standard/no-parallel-interface').map(({ line, message }) => `${line}: ${message}`),
    ).toEqual([
      '1: ILogger is a home-made copy of a standard interface: use Logger.',
      '2: CurrentUser is a home-made copy of a standard interface: use ExecutionContext or Actor.',
    ]);

    expect(
      reported(configured, 'standard/no-parallel-interface').map(({ line, message }) => `${line}: ${message}`),
    ).toEqual([
      '1: ILogger is a home-made copy of a standard interface: use Logger (see ADR-0003).',
      '3: TenantInfo is a home-made copy of a standard interface: use TenantScoped.',
    ]);
  });

  it('writes standardInterfaces back only when the config holds some', () => {
    const configured = parseConfig({
      standardInterfaces: { CurrentUser: false, TenantInfo: 'TenantScoped', Wrong: 3 },
    });

    expect(JSON.parse(serializeConfig(configured))).toMatchObject({
      standardInterfaces: { CurrentUser: false, TenantInfo: 'TenantScoped' },
    });

    expect(JSON.parse(serializeConfig(parseConfig({})))).not.toHaveProperty('standardInterfaces');
  });
});
