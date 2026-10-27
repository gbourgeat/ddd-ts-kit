import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { committedProject } from './support/committed-project';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const MAIN = 'prisma/schema/schema.prisma';
const BILLING = 'prisma/schema/billing.prisma';

describe('generate repository on Prisma', () => {
  it('writes the models of a context in a file of its own, and its database schema once in the datasource', () => {
    const root = initProject('--orm', 'prisma', '--audit', 'off', '--context', 'billing:core');

    expect(read(root, 'prisma.config.ts')).toContain("schema: './prisma/schema',");
    expect(read(root, MAIN)).toContain('output              = "../../generated/prisma"');
    expect(exists(root, 'prisma/schema.prisma')).toBe(false);

    for (const aggregate of ['Invoice', 'CreditNote']) {
      cli(root, 'generate', 'aggregate', 'billing', aggregate, '--allow-name');
      cli(root, 'generate', 'repository', 'billing', aggregate, '--allow-name');
    }

    const models = read(root, BILLING);

    expect(models).toContain('model BillingInvoice {');
    expect(models).toContain('model BillingCreditNote {');
    expect(models).toContain('@@schema("billing")');
    expect(read(root, MAIN)).not.toContain('model Billing');
    expect(read(root, MAIN)).toContain('schemas  = ["messaging", "billing"]');
  });

  it('lets a worker confined to its context add a repository once the context has its schema', () => {
    const root = initProject('--orm', 'prisma', '--audit', 'off', '--context', 'billing:core');

    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');
    cli(root, 'generate', 'repository', 'billing', 'Invoice', '--allow-name');
    cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--allow-name');

    const local = cli(root, 'generate', 'repository', 'billing', 'CreditNote', '--allow-name', '--local-only');

    expect(local.code, local.stderr).toBe(0);
    expect(read(root, BILLING)).toContain('model BillingCreditNote {');
  });

  it('briefs the worker of a context that its models are its own, to change with the mapper', () => {
    const root = committedProject(
      'shop',
      '--orm',
      'prisma',
      '--package-manager',
      'npm',
      '--audit',
      'off',
      '--context',
      'billing:core',
    );

    const briefing = String(jsonAt(cli(root, 'worker-scope', 'billing', '--dry-run', '--json').json(), 'briefing'));

    expect(briefing).toContain(
      '- The models of your context are yours too: prisma/schema/billing.prisma. A stored field changes its\n' +
        '  column there and the mapper in the same commit; then `npm run db:client`.',
    );
  });
});
