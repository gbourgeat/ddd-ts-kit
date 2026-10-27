import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { filesUnder } from '../src/generate/files-under';
import { Workspace } from '../src/workspace';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers';

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
      "export * from '@/contexts/billing/infrastructure/external/simulated-exchange-rates.adapter';",
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
