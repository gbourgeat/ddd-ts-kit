import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { argumentsOf } from '../src/check/declarations/arguments-of.js';
import { classesOf } from '../src/check/declarations/classes-of.js';
import { literalIn } from '../src/check/declarations/literal-in.js';
import { optionOf } from '../src/check/declarations/option-of.js';
import { runCheck } from '../src/check/engine/run-check.js';
import { loadProject } from '../src/check/project/load-project.js';
import { scan } from '../src/check/scan/scan.js';
import { renderBarrel } from '../src/declared/index.js';
import { cli, tempDir } from './helpers.js';

const BILLING = 'src/contexts/billing';
/** As a new project writes it: an import names its file without an extension. */
const inBilling = (file: string): string => `@/contexts/billing/${file.replace(/\.ts$/, '')}`;
const CONFIG = 'ddd-ts-kit.config.json';
const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";
const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const QUERY = `${BILLING}/application/queries/search-invoices/search-invoices.query.ts`;
const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const POLICY = `${BILLING}/application/authorization/only-issuer-voids.policy.ts`;
const REPOSITORY = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const GATEWAY = `${BILLING}/infrastructure/external/in-process-price-catalog.gateway.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const BARREL = `${BILLING}/billing.declarations.ts`;

const SOURCES = {
  [COMMAND]: `import { Requires } from ${DECLARATIONS};\n\n@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand {}\n`,
  [HANDLER]: `import { CommandHandler } from ${DECLARATIONS};\n\n@CommandHandler(IssueInvoiceCommand, [])\nexport class IssueInvoiceHandler {}\n`,
  [QUERY]: `import { Public } from ${DECLARATIONS};\n\n@Public()\nexport class SearchInvoicesQuery {}\n`,
  [INTEGRATION_HANDLER]: `import { IntegrationEventHandler } from ${DECLARATIONS};\n\n@IntegrationEventHandler(\n  productListedV1,\n  { consumer: 'billing.product-listed' },\n  [],\n)\nexport class ProductListedIntegrationHandler {}\n`,
  [EVENT]: "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n}\n",
  [EVENT_HANDLER]: `import { DomainEventHandler } from ${DECLARATIONS};\nimport { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event';\n\n@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler {}\n`,
  [POLICY]: `import { Policy } from ${DECLARATIONS};\n\n@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })\nexport class OnlyIssuerVoidsPolicy {}\n`,
  [REPOSITORY]: `import { Repository } from ${DECLARATIONS};\n\n@Repository(InvoiceRepository, [Database])\nexport class KnexInvoiceRepository implements InvoiceRepository {}\n`,
  [GATEWAY]: `import { Gateway } from ${DECLARATIONS};\n\n@Gateway(PriceCatalogGateway, [PriceCatalogUpstream])\nexport class InProcessPriceCatalogGateway implements PriceCatalogGateway {}\n`,
};

describe('reading declarations at text level', () => {
  const read = (source: string): ReturnType<typeof classesOf> => classesOf(scan(source));

  const carried = (source: string): string[] =>
    read(source).flatMap((declared) => declared.decorations.map(({ name }) => `${declared.name}:${name}`));

  it('finds a decorator above the export, between export and class, called or not, over several lines', () => {
    const source = [
      `import { Adapter, Public, Requires } from ${DECLARATIONS};`,
      "@Requires(\n  permissions['a.b'],\n  { resource: (command: A) => ({ type: 'a', id: command.id }) },\n)\nexport class A {}",
      'export @Public class B {}',
      '@injectable()\n@Adapter(Port)\nexport default class C {}',
      'class D {}',
    ].join('\n');

    expect(carried(source)).toEqual(['A:Requires', 'B:Public', 'C:Adapter']);

    expect(read(source).map(({ name, exported }) => `${name}:${exported}`)).toEqual([
      'A:true',
      'B:true',
      'C:true',
      'D:false',
    ]);
  });

  it('counts a decorator only when its own name is imported from the kernel declarations', () => {
    expect(carried("import { Requires } from './home-made.js';\n@Requires(permission)\nexport class A {}\n")).toEqual(
      [],
    );

    expect(
      carried(`import { Requires as Needs } from ${DECLARATIONS};\n@Needs(permission)\nexport class A {}\n`),
    ).toEqual([]);

    expect(
      carried(`import * as declare from ${DECLARATIONS};\n@declare.Requires(permission)\nexport class A {}\n`),
    ).toEqual([]);

    expect(carried(`import { Requires } from ${DECLARATIONS};\n// @Requires(permission)\nexport class A {}\n`)).toEqual(
      [],
    );
  });

  it('leaves the decorators of members and of nested classes alone', () => {
    const source = `import { Adapter } from ${DECLARATIONS};\nexport class A {\n  @Adapter(Port)\n  run(): void {}\n}\nexport function make(): unknown {\n  @Adapter(Port)\n  class Inner {}\n  return Inner;\n}\n`;

    expect(carried(source)).toEqual([]);
  });

  it('reads the arguments and the literal inside one', () => {
    const source = scan(
      `import { Requires } from ${DECLARATIONS};\n@Requires(permissions['invoice.issue'], { audited: ['a', 'b'] })\nexport class A {}\n`,
    );

    const [decoration] = classesOf(source)[0]?.decorations ?? [];
    const parts = decoration === undefined ? [] : argumentsOf(source, decoration);

    expect(parts.map(({ code }) => code.replace(/\s+/g, ''))).toEqual(["permissions['']", "{audited:['','']}"]);
    expect(parts[0] === undefined ? undefined : literalIn(source, parts[0])).toBe('invoice.issue');
  });

  it('tells a written name from anything else', () => {
    const name = (options: string): string | undefined => {
      const source = scan(
        `import { Policy } from ${DECLARATIONS};\n@Policy(permission, ${options})\nexport class A {}\n`,
      );

      const [decoration] = classesOf(source)[0]?.decorations ?? [];
      const value = decoration === undefined ? undefined : optionOf(source, decoration, 'name');

      return value === undefined ? 'absent' : value.literal;
    };

    expect(name("{ name: 'billing.rule' }")).toBe('billing.rule');
    expect(name('{ name: `billing.rule`, other: 1 }')).toBe('billing.rule');
    expect(name("{ name: '' }")).toBe('');
    expect(name('{ name: NAME }')).toBeUndefined();
    expect(name('{ name }')).toBeUndefined();
    expect(name('{ name: `${CONTEXT}.rule` }')).toBeUndefined();
    expect(name("{ name: 'billing.' + RULE }")).toBeUndefined();
    expect(name('options')).toBe('absent');
    expect(name("{ resource: (subject: A) => ({ name: 'inner' }) }")).toBe('absent');
  });
});

describe('the declared style in check and check-file', () => {
  it('judges a role file alone in check-file, and leaves the barrel to the full check', () => {
    const root = declaredProject(
      {
        ...SOURCES,
        [QUERY]: 'export class SearchInvoicesQuery {}\n',
        [HANDLER]: 'export class IssueInvoiceHandler {}\n',
      },
      { [BARREL]: 'export {};\n' },
    );

    expect(reported(root, QUERY)).toEqual([`authz/declared ${QUERY}:1`]);
    expect(reported(root, HANDLER)).toEqual([`declarations/role-declared ${HANDLER}:1`]);
    expect(reported(root, COMMAND)).toEqual([]);

    expect(reported(root).filter((line) => line.startsWith('declarations/barrel-current'))).toEqual([
      `declarations/barrel-current ${BARREL}:1`,
    ]);
  });

  it('follows the import of the event class in check-file to compare the two names', () => {
    const root = declaredProject({
      ...SOURCES,
      [EVENT_HANDLER]: SOURCES[EVENT_HANDLER].replace('billing.invoice.issued', 'billing.invoice.sent'),
    });

    const [violation] = runCheck(loadProject(root, { onlyFile: EVENT_HANDLER }), { fileScopeOnly: true }).violations;

    expect(violation).toMatchObject({
      ruleId: 'declarations/role-declared',
      line: 4,
      message:
        '@DomainEventHandler is named "billing.invoice.sent" but InvoiceIssued is named "billing.invoice.issued".',
    });

    expect(reported(declaredProject(SOURCES), EVENT_HANDLER)).toEqual([]);
  });

  it('reports an empty name, and a name it cannot read once per rule that holds it', () => {
    const root = declaredProject({
      ...SOURCES,
      [POLICY]: SOURCES[POLICY].replace("'billing.only-issuer-voids'", "''"),
      [INTEGRATION_HANDLER]: SOURCES[INTEGRATION_HANDLER].replace("'billing.product-listed'", 'NAME'),
    });

    expect(messages(root, POLICY)).toEqual(['The name of @Policy on OnlyIssuerVoidsPolicy is empty.']);

    expect(messages(root, INTEGRATION_HANDLER)).toEqual([
      'The consumer of @IntegrationEventHandler on ProductListedIntegrationHandler is not a string literal.',
      'The consumer name of ProductListedIntegrationHandler is not a string literal.',
    ]);
  });

  it('accepts a decorated message registered in an explicit module, read from disk in check-file', () => {
    const module = (name: string): string =>
      `import { ${name} } from './application/commands/issue-invoice/issue-invoice.command.js';\nexport function register(builder: Builder): void {\n  builder.command(${name}).handledBy(IssueInvoiceHandler, []);\n}\n`;

    const decorated = explicitProject({ [COMMAND]: SOURCES[COMMAND], [MODULE]: module('IssueInvoiceCommand') });

    const plain = explicitProject({
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [MODULE]: module('IssueInvoiceCommand'),
    });

    expect(reported(decorated, MODULE)).toEqual([]);
    expect(reported(decorated)).toEqual([]);
    expect(reported(plain, MODULE)).toEqual([`authz/declared ${MODULE}:3`]);
  });

  it('never takes an integration event handler or a domain event handler for a use case handler', () => {
    const root = declaredProject({
      ...SOURCES,
      [INTEGRATION_HANDLER]: SOURCES[INTEGRATION_HANDLER].replace(/IntegrationEventHandler/g, 'CommandHandler'),
      [EVENT_HANDLER]: SOURCES[EVENT_HANDLER].replace(/DomainEventHandler/g, 'QueryHandler'),
    });

    expect(messages(root, INTEGRATION_HANDLER)).toEqual([
      'ProductListedIntegrationHandler carries @CommandHandler, but a *.integration-handler.ts file under application/integration/handlers/ declares @IntegrationEventHandler.',
    ]);

    expect(messages(root, EVENT_HANDLER)).toEqual([
      'InvoiceIssuedEventHandler carries @QueryHandler, but a *.event-handler.ts file under application/event-handlers/ declares @DomainEventHandler.',
    ]);
  });

  it('compares the barrel whatever its line endings, and skips a directory the config does not declare', () => {
    const barrel = renderBarrel(
      Object.keys(SOURCES).map((file) => file.slice(BILLING.length + 1)),
      inBilling,
    );

    const root = declaredProject(SOURCES, {
      [BARREL]: barrel.replaceAll('\n', '\r\n'),
      'src/contexts/draft/domain/events/noted.event.ts': 'export class Noted {}\n',
    });

    expect(reported(root).filter((line) => line.startsWith('declarations/'))).toEqual([]);
  });

  it('knows both declaration rules in rules, explain and the config', () => {
    const root = declaredProject(
      SOURCES,
      {},
      { rules: { 'declarations/role-declared': 'warn', 'declarations/barrel-current': 'off' }, deviations: [] },
    );

    const listed = [
      expect.objectContaining({ id: 'declarations/role-declared', severity: 'warn' }),
      expect.objectContaining({ id: 'declarations/barrel-current', severity: 'off' }),
    ];

    expect(cli(root, 'rules', '--json').json()).toEqual(expect.arrayContaining(listed));
    expect(cli(root, 'explain', 'declarations/barrel-current').stdout).toContain('ddd-ts-kit docs');
    expect(reported(root).filter((line) => line.startsWith('config/valid'))).toEqual([]);
    expect(cli(tempDir('defaults'), 'rules').stdout).toMatch(/declarations\/role-declared\s+error/);
  });
});

/** What `list --json` says of the declared billing context. */
const BILLING_LISTED = {
  commands: ['IssueInvoice'],
  queries: ['SearchInvoices'],
  integrationEventHandlers: ['ProductListedIntegrationHandler'],
  policies: ['billing.only-issuer-voids'],
  gateways: ['InProcessPriceCatalogGateway'],
  declarations: {
    useCases: [
      { kind: 'command', name: 'IssueInvoice', requires: 'invoice.issue' },
      { kind: 'query', name: 'SearchInvoices', requires: 'public' },
    ],
    integrationEventHandlers: [
      { name: 'ProductListedIntegrationHandler', consumer: 'billing.product-listed', event: 'productListedV1' },
    ],
    policies: [{ name: 'billing.only-issuer-voids', permission: 'invoice.void' }],
    gateways: [{ name: 'InProcessPriceCatalogGateway', token: 'PriceCatalogGateway' }],
    adapters: [{ name: 'KnexInvoiceRepository', token: 'InvoiceRepository' }],
  },
};

describe('list in the declared style', () => {
  it('reads use cases, handlers, policies, gateways and adapters from the decorators', () => {
    const root = declaredProject(SOURCES);
    const text = cli(root, 'list').stdout;

    expect(text).toContain('  commands: IssueInvoice (requires invoice.issue)\n  queries: SearchInvoices (public)\n');

    expect(text).toContain(
      '  integration event handlers: ProductListedIntegrationHandler (consumer billing.product-listed, on productListedV1)\n',
    );

    expect(text).toContain(
      '  policies: billing.only-issuer-voids (on invoice.void)\n  gateways: InProcessPriceCatalogGateway (PriceCatalogGateway)\n  adapters: KnexInvoiceRepository (InvoiceRepository)\n',
    );

    expect(cli(root, 'list', '--json').json()).toMatchObject({ contexts: [BILLING_LISTED] });
  });

  it('leaves out a message that declares nothing, and reads no decorator in the explicit style', () => {
    const undeclared = declaredProject({ ...SOURCES, [QUERY]: 'export class SearchInvoicesQuery {}\n' });
    const explicit = explicitProject(SOURCES);

    expect(cli(undeclared, 'list').stdout).toContain('  queries: none\n');

    expect(cli(explicit, 'list').stdout).toContain(
      '  commands: IssueInvoice\n  queries: SearchInvoices\n  domain events: InvoiceIssued\n  published events: none\n  integration event handlers: ProductListed\n',
    );

    expect(cli(explicit, 'list').stdout).not.toContain('adapters:');
    expect(cli(explicit, 'list', '--json').json()).not.toHaveProperty('contexts[0].declarations');
  });
});

type Files = Readonly<Record<string, string>>;

function declaredProject(files: Files, overrides: Files = {}, config: Record<string, unknown> = {}): string {
  const barrel = renderBarrel(
    Object.keys(files).flatMap((file) => (file.startsWith(`${BILLING}/`) ? [file.slice(BILLING.length + 1)] : [])),
    inBilling,
  );

  return projectWith({ [BARREL]: barrel, ...files, ...overrides }, { stack: { style: 'declared' }, ...config });
}

function explicitProject(files: Files): string {
  return projectWith(files, {});
}

function projectWith(files: Files, config: Record<string, unknown>): string {
  const root = tempDir('declared');

  const contexts = { billing: { classification: 'core', upstreams: [] } };
  const written = { [CONFIG]: JSON.stringify({ importExtension: 'none', contexts, ...config }, null, 2), ...files };

  for (const [file, content] of Object.entries(written)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
}

const JUDGED = [
  'authz/declared',
  'declarations/role-declared',
  'declarations/barrel-current',
  'events/consumer-idempotent',
  'config/valid',
];

function reported(root: string, onlyFile?: string): string[] {
  return violations(root, onlyFile).map(({ ruleId, file, line }) => `${ruleId} ${file}:${line}`);
}

function messages(root: string, onlyFile: string): string[] {
  return violations(root, onlyFile).map(({ message }) => message);
}

function violations(root: string, onlyFile?: string): ReturnType<typeof runCheck>['violations'] {
  const project = onlyFile === undefined ? loadProject(root) : loadProject(root, { onlyFile });

  return runCheck(project, { rules: JUDGED, fileScopeOnly: onlyFile !== undefined }).violations;
}
