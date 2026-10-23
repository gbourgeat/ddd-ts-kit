import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { specifierOf } from '../src/alias';
import { readConfig } from '../src/config';
import { contextDeclarations, isDeclarationsFile, singleFileDeclarations, type DeclaredContext } from '../src/declared';
import { filesUnder } from '../src/generate/files-under';
import { workspaceSources } from '../src/generate/workspace-sources';
import { Workspace } from '../src/workspace';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers';
import { declaredModules } from '../src/model-modules';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('declared-declarations');
  scaffoldEverything(root);
});

/** What assembles a context in the declared style: the declarations of each layer, and their summary at its root. */
describe('the declarations of a context generated in the declared style', () => {
  it('exports every role file from the declarations of its layer, which the summary of the context re-exports, sorted by path', () => {
    expect(read(root, `${BILLING}/billing.declarations.ts`)).toBe(
      [
        "export * from '@/contexts/billing/application/application.declarations';",
        "export * from '@/contexts/billing/infrastructure/infrastructure.declarations';",
        "export * from '@/contexts/billing/presentation/presentation.declarations';",
        '',
      ].join('\n'),
    );

    expect(fs.existsSync(path.join(root, `${BILLING}/application/commands/commands.declarations.ts`))).toBe(false);

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

  it('registers in the declarations of each layer what each constructor takes, read from its signature, and nothing for a class that takes nothing', () => {
    const barrel = declarationsOf(BILLING);
    const application = read(root, `${BILLING}/application/application.declarations.ts`);
    const infrastructure = read(root, `${BILLING}/infrastructure/infrastructure.declarations.ts`);

    expect(application.split('\n')[0]).toBe("import { injected } from '@ddd-ts-kit/kernel/declarations';");

    expect(application).toContain(
      "import { Clock, CommandBus, IdGenerator, IntegrationEventPublisher, ProcessRunner } from '@ddd-ts-kit/kernel';",
    );

    expect(application.trimEnd().split('\n').at(-1)).toMatch(/^injected\(/);
    expect(application).not.toContain('Database');
    expect(infrastructure).toContain("import { Database } from '@/platform/database/database';");
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
      "import { Adapter } from '@ddd-ts-kit/kernel/declarations';\nimport { InvoiceStatusContract } from '@/contexts/billing/published-language';\n\n@Adapter(InvoiceStatusContract)\nexport class RemoteCarrier implements InvoiceStatusContract {}\n",
    );

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain(`${SHIPPING}/infrastructure/infrastructure.declarations.ts`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);

    expect(cli(root, 'docs').code).toBe(0);

    expect(read(root, `${SHIPPING}/infrastructure/infrastructure.declarations.ts`)).toContain(
      "export * from '@/contexts/shipping/infrastructure/external/remote-carrier.adapter';",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);

    const emptied = `${SHIPPING}/infrastructure/carriers/carriers.declarations.ts`;

    write(root, emptied, 'export {};\n');

    expect(cli(root, 'docs', '--check').stdout).toContain(`stale  ${emptied}: it is no longer generated`);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').stdout).toContain(emptied);

    const docs = cli(root, 'docs');

    expect(docs.stdout).toMatch(new RegExp(`deleted\\s+${emptied}`));
    expect(fs.existsSync(path.join(root, emptied))).toBe(false);
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);

    const infrastructure = `${SHIPPING}/infrastructure/infrastructure.declarations.ts`;

    for (const file of filesUnder(new Workspace(root, false), `${SHIPPING}/infrastructure`)) {
      if (!file.endsWith('.declarations.ts')) {
        fs.rmSync(path.join(root, SHIPPING, 'infrastructure', file));
      }
    }

    expect(cli(root, 'docs').stdout).toContain(infrastructure);
    expect(fs.existsSync(path.join(root, infrastructure))).toBe(false);
  });
});

describe('a context still declared in the single file of 0.84', () => {
  const summary = `${BILLING}/billing.declarations.ts`;
  const application = `${BILLING}/application/application.declarations.ts`;

  it('is a warning for check and docs --check, which pass, and generate --local-only leaves it alone', () => {
    const single = toSingleFile('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.code).toBe(0);

    expect(checked.json()).toMatchObject({
      errors: 0,
      violations: [{ ruleId: 'declarations/barrel-current', severity: 'warn', file: summary }],
    });

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').stdout).toContain(
      'a later minor version reports them as an error',
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
      application,
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';\n",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    expect(cli(root, 'docs', '--check').code).toBe(1);
    fs.rmSync(path.join(root, application));
  });

  it('moves to the declarations of the layers on docs, and the warning goes', () => {
    const moved = cli(root, 'docs');

    expect(moved.stdout).toMatch(new RegExp(`created\\s+${application}`));

    expect(read(root, summary)).toContain("export * from '@/contexts/billing/application/application.declarations';");

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.json()).toMatchObject({ errors: 0, warnings: 0 });
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');
  });
});

describe('a context still declared in the files of its role folders, as 0.85 and 0.86 wrote them', () => {
  const summary = `${BILLING}/billing.declarations.ts`;
  const commands = `${BILLING}/application/commands/commands.declarations.ts`;

  it('is a warning for check and docs --check, which pass, and generate --local-only leaves it alone', () => {
    toRoleFolders('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.code).toBe(0);

    expect(checked.json()).toMatchObject({
      errors: 0,
      violations: [{ ruleId: 'declarations/barrel-current', severity: 'warn', file: summary }],
    });

    const docs = cli(root, 'docs', '--check');

    expect(docs.code).toBe(0);

    expect(docs.stdout).toContain(
      `warning  ${summary}: "billing" still keeps its declarations in one file per role folder`,
    );

    const local = cli(root, 'generate', 'port', 'shipping', 'ParcelTracking', '--local-only');

    expect(local.code).toBe(0);
    expect(local.stdout).toContain('note: "billing" still keeps its declarations in one file per role folder');
    expect(fs.existsSync(path.join(root, commands))).toBe(true);
  });

  it('is an error once one of its files is stale', () => {
    const written = read(root, commands);
    const handler = "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';\n";

    expect(written).toContain(handler);
    write(root, commands, written.replace(handler, ''));
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    write(root, commands, written);
  });

  it('moves to the declarations of the layers on docs, which deletes the files of the role folders', () => {
    const moved = cli(root, 'docs');

    expect(moved.stdout).toMatch(new RegExp(`deleted\\s+${commands}`));
    expect(fs.existsSync(path.join(root, commands))).toBe(false);
    expect(read(root, summary)).toContain("export * from '@/contexts/billing/application/application.declarations';");
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current', '--json').json()).toMatchObject({ warnings: 0 });
  });
});

/** A context of the scaffolded project, read where its files are. */
function declaredContext(context: string): DeclaredContext {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);
  const directory = `${config.contextsDir}/${context}`;

  return {
    context,
    directory,
    entries: filesUnder(ws, directory),
    sources: workspaceSources(ws, config),
    modules: declaredModules(config, context),
    specifierOf: (file) => specifierOf(config, file),
  };
}

/** Puts a context back in the layout the generator wrote in 0.85 and 0.86: one declarations file per role folder. */
function toRoleFolders(context: string): void {
  const declared = declaredContext(context);
  const { directory, entries, modules } = declared;

  for (const entry of entries.filter((candidate) => isDeclarationsFile(context, candidate, modules))) {
    fs.rmSync(path.join(root, directory, entry));
  }

  contextDeclarations(declared, 'role-folder').files.forEach((content, entry) =>
    write(root, `${directory}/${entry}`, content),
  );
}

/**
 * Puts a context back in the layout the generator wrote up to 0.84: every declaration in
 * `<context>.declarations.ts`, no declarations file in a role folder. Answers that file.
 */
function toSingleFile(context: string): string {
  const declared = declaredContext(context);
  const { directory, entries, modules } = declared;
  const single = singleFileDeclarations(declared);

  for (const entry of entries.filter((candidate) => isDeclarationsFile(context, candidate, modules))) {
    fs.rmSync(path.join(root, directory, entry));
  }

  write(root, `${directory}/${context}.declarations.ts`, single);

  return single;
}

/** The declarations of every layer of a context, in the order its summary re-exports them. */
function declarationsOf(context: string): string {
  const alias = `@/${context.slice('src/'.length)}/`;

  return read(root, `${context}/${path.posix.basename(context)}.declarations.ts`)
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^export \* from '(.+)';$/, '$1').slice(alias.length))
    .map((folder) => read(root, `${context}/${folder}.ts`))
    .join('\n');
}
