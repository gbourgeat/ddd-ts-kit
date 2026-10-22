import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { specifierOf } from '../src/alias/index.js';
import { readConfig } from '../src/config/index.js';
import { isDeclarationsFile, singleFileDeclarations } from '../src/declared/index.js';
import { filesUnder } from '../src/generate/files-under.js';
import { workspaceSources } from '../src/generate/workspace-sources.js';
import { Workspace } from '../src/workspace/index.js';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers.js';
import { declaredModules } from '../src/model-modules/index.js';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('declared-declarations');
  scaffoldEverything(root);
});

/** What assembles a context in the declared style: the declarations of each role folder, and their summary at its root. */
describe('the declarations of a context generated in the declared style', () => {
  it('exports every role file from the declarations of its role folder, which the summary of the context re-exports, sorted by path', () => {
    expect(read(root, `${BILLING}/billing.declarations.ts`)).toBe(
      [
        "export * from '@/contexts/billing/application/authorization/authorization.declarations';",
        "export * from '@/contexts/billing/application/background/background.declarations';",
        "export * from '@/contexts/billing/application/commands/commands.declarations';",
        "export * from '@/contexts/billing/application/event-handlers/event-handlers.declarations';",
        "export * from '@/contexts/billing/application/integration/integration.declarations';",
        "export * from '@/contexts/billing/application/queries/queries.declarations';",
        "export * from '@/contexts/billing/application/scheduling/scheduling.declarations';",
        "export * from '@/contexts/billing/infrastructure/external/external.declarations';",
        "export * from '@/contexts/billing/infrastructure/persistence/persistence.declarations';",
        "export * from '@/contexts/billing/presentation/http/http.declarations';",
        '',
      ].join('\n'),
    );

    const barrel = declarationsOf(BILLING).split('\n');

    expect(barrel.filter((line) => line.startsWith('export ') && !line.includes('/background/'))).toEqual([
      "export * from '@/contexts/billing/application/authorization/only-issuer-cancels.policy';",
      "export * from '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.command';",
      "export * from '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.handler';",
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';",
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';",
      "export * from '@/contexts/billing/application/event-handlers/invoice-issued.event-handler';",
      "export * from '@/contexts/billing/application/event-handlers/invoice-marked-as-paid.event-handler';",
      "export * from '@/contexts/billing/application/event-handlers/thank-buyer.event-handler';",
      "export * from '@/contexts/billing/application/integration/publishers/invoice-issued-v2.publisher';",
      "export * from '@/contexts/billing/application/integration/publishers/invoice-issued.publisher';",
      "export * from '@/contexts/billing/application/queries/search-invoices/search-invoices.handler';",
      "export * from '@/contexts/billing/application/queries/search-invoices/search-invoices.query';",
      "export * from '@/contexts/billing/application/scheduling/cancel-stale-invoices.job';",
      "export * from '@/contexts/billing/application/scheduling/issue-invoices-monthly.job';",
      "export * from '@/contexts/billing/infrastructure/external/remote-payment-gateway.adapter';",
      "export * from '@/contexts/billing/infrastructure/external/remote-tax-rates.adapter';",
      "export * from '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository';",
      "export * from '@/contexts/billing/infrastructure/persistence/in-memory-search-invoices-reader.repository';",
      "export * from '@/contexts/billing/presentation/http/invoices/cancel-invoice/cancel-invoice.controller';",
      "export * from '@/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.controller';",
      "export * from '@/contexts/billing/presentation/http/invoices/search-invoices/search-invoices.controller';",
    ]);
  });

  it('registers in the declarations of each folder what each constructor takes, read from its signature, and nothing for a class that takes nothing', () => {
    const barrel = declarationsOf(BILLING);
    const commands = read(root, `${BILLING}/application/commands/commands.declarations.ts`);
    const persistence = read(root, `${BILLING}/infrastructure/persistence/persistence.declarations.ts`);

    expect(commands.split('\n')[0]).toBe("import { injected } from '@ddd-ts-kit/kernel/declarations';");
    expect(commands).toContain("import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';");
    expect(commands.trimEnd().split('\n').at(-1)).toMatch(/^injected\(/);
    expect(commands).not.toContain('Database');
    expect(persistence).toContain("import { Database } from '@/platform/database/database';");
    expect(read(root, `${BILLING}/billing.declarations.ts`)).not.toContain('injected');
    expect(barrel).toContain('injected(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);');
    expect(barrel).toContain('injected(SearchInvoicesHandler, [SearchInvoicesReader, Access]);');
    expect(barrel).toContain('injected(InvoiceIssuedPublisher, [IntegrationEventPublisher, IdGenerator]);');
    expect(barrel).toContain('injected(CancelStaleInvoicesJob, [CommandBus]);');
    expect(barrel).toContain('injected(SearchInvoicesController, [QueryBus]);');
    expect(barrel).toContain('injected(DrizzleInvoiceRepository, [Database, ExecutionScope, Clock]);');
    expect(barrel).toContain('injected(CancelInvoiceHandler, [Access]);');
    expect(barrel).not.toContain('injected(OnlyIssuerCancelsPolicy');
  });
});

describe('the declarations of a context, as its tree changes', () => {
  it('rewrites the declarations on every generate and on docs, reports the ones a hand-added role file left behind, and deletes the ones of an emptied folder', () => {
    const added = `${SHIPPING}/infrastructure/external/remote-carrier.adapter.ts`;

    write(
      root,
      added,
      "import { Adapter } from '@ddd-ts-kit/kernel/declarations';\nimport { InvoiceStatusContract } from '@/contexts/billing/published-language/index';\n\n@Adapter(InvoiceStatusContract)\nexport class RemoteCarrier implements InvoiceStatusContract {}\n",
    );

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain(`stale  ${SHIPPING}/infrastructure/external/external.declarations.ts`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);

    expect(cli(root, 'docs').code).toBe(0);

    expect(read(root, `${SHIPPING}/infrastructure/external/external.declarations.ts`)).toContain(
      "export * from '@/contexts/shipping/infrastructure/external/remote-carrier.adapter';",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);

    const moved = `${SHIPPING}/infrastructure/remote-carrier.adapter.ts`;
    const emptied = `${SHIPPING}/infrastructure/carriers/carriers.declarations.ts`;

    write(root, emptied, 'export {};\n');
    write(root, moved, read(root, added));
    fs.rmSync(path.join(root, added));

    expect(cli(root, 'docs', '--check').stdout).toContain(`stale  ${emptied}: it is no longer generated`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').stdout).toContain(emptied);

    const docs = cli(root, 'docs');

    expect(docs.stdout).toMatch(new RegExp(`deleted\\s+${emptied}`));
    expect(fs.existsSync(path.join(root, emptied))).toBe(false);

    expect(read(root, `${SHIPPING}/infrastructure/infrastructure.declarations.ts`)).toBe(
      "export * from '@/contexts/shipping/infrastructure/remote-carrier.adapter';\n",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);
    fs.rmSync(path.join(root, moved));
    expect(cli(root, 'docs').stdout).toContain(`${SHIPPING}/infrastructure/infrastructure.declarations.ts`);
    expect(fs.existsSync(path.join(root, `${SHIPPING}/infrastructure/infrastructure.declarations.ts`))).toBe(false);
  });
});

describe('a context still declared in the single file of 0.84', () => {
  const summary = `${BILLING}/billing.declarations.ts`;
  const commands = `${BILLING}/application/commands/commands.declarations.ts`;

  it('is a warning for check and docs --check, which pass, and generate --local-only leaves it alone', () => {
    const single = toSingleFile('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.code).toBe(0);

    expect(checked.json()).toMatchObject({
      errors: 0,
      violations: [{ ruleId: 'declarations/barrel-current', severity: 'warn', file: summary }],
    });

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').stdout).toContain(
      'a later minor version reports it as an error',
    );

    const docs = cli(root, 'docs', '--check');

    expect(docs.code).toBe(0);
    expect(docs.stdout).toContain('The generated documentation is up to date.');

    expect(docs.stdout).toContain(
      `warning  ${summary}: "billing" still keeps all its declarations in billing.declarations.ts`,
    );

    expect(docs.stdout).toContain('Run `npx ddd-ts-kit docs`');

    const local = cli(root, 'generate', 'port', 'shipping', 'CarrierRates', '--local-only');

    expect(local.code).toBe(0);
    expect(local.stdout).toContain('note: "billing" still keeps all its declarations in billing.declarations.ts');
    expect(read(root, summary)).toBe(single);
  });

  it('is an error once the single file is stale, or once the context is half moved', () => {
    const single = read(root, summary);
    const job = "export * from '@/contexts/billing/application/scheduling/cancel-stale-invoices.job';\n";

    expect(single).toContain(job);
    write(root, summary, single.replace(job, ''));
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    expect(cli(root, 'docs', '--check').code).toBe(1);

    write(root, summary, single);

    write(
      root,
      commands,
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';\n",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    expect(cli(root, 'docs', '--check').code).toBe(1);
    fs.rmSync(path.join(root, commands));
  });

  it('moves to the declarations of the role folders on docs, and the warning goes', () => {
    const moved = cli(root, 'docs');

    expect(moved.stdout).toMatch(new RegExp(`created\\s+${commands}`));

    expect(read(root, summary)).toContain(
      "export * from '@/contexts/billing/application/commands/commands.declarations';",
    );

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.json()).toMatchObject({ errors: 0, warnings: 0 });
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');
  });
});

/**
 * Puts a context back in the layout the generator wrote up to 0.84: every declaration in
 * `<context>.declarations.ts`, no declarations file in a role folder. Answers that file.
 */
function toSingleFile(context: string): string {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);
  const directory = `${config.contextsDir}/${context}`;
  const entries = filesUnder(ws, directory);

  const single = singleFileDeclarations({
    context,
    directory,
    entries,
    sources: workspaceSources(ws, config),
    modules: declaredModules(config, context),
    specifierOf: (file) => specifierOf(config, file),
  });

  for (const entry of entries.filter((candidate) =>
    isDeclarationsFile(context, candidate, declaredModules(config, context)),
  )) {
    fs.rmSync(path.join(root, directory, entry));
  }

  write(root, `${directory}/${context}.declarations.ts`, single);

  return single;
}

/** The declarations of every role folder of a context, in the order its summary re-exports them. */
function declarationsOf(context: string): string {
  const alias = `@/${context.slice('src/'.length)}/`;

  return read(root, `${context}/${path.posix.basename(context)}.declarations.ts`)
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^export \* from '(.+)';$/, '$1').slice(alias.length))
    .map((folder) => read(root, `${context}/${folder}.ts`))
    .join('\n');
}
