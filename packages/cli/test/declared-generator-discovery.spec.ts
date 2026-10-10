import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir } from './helpers.js';

const BILLING = 'src/contexts/billing';

describe('discovery in place of the barrel', () => {
  let discovered: string;

  beforeAll(() => {
    discovered = tempDir('discovery');

    scaffoldEverything(discovered, {
      http: 'express',
      validation: 'zod',
      di: 'tsyringe',
      tests: 'vitest',
      orm: 'knex',
      events: 'outbox',
      assembly: 'discovery',
    });
  });

  it('writes no barrel: the composition root discovers each context, publishers included', () => {
    const composition = read(discovered, 'src/platform/compose-application.ts');

    expect(exists(discovered, `${BILLING}/billing.declarations.ts`)).toBe(false);

    expect(composition).toContain(
      "    await discoverContext('billing', new URL('../contexts/billing/', import.meta.url)),",
    );

    expect(composition).not.toContain('InvoiceIssuedPublisher');

    expect(read(discovered, 'src/apps/shipping/main.ts')).toContain(
      "await discoverContext('shipping', new URL('../../contexts/shipping/', import.meta.url))",
    );
  });

  it('discovers the context in the specs too', () => {
    const spec = read(discovered, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`);

    expect(spec).toContain("const context = await discoverContext('billing', new URL('../../', import.meta.url));");
    expect(spec).toContain('modules: [platformTestModule, context, holders],');

    expect(read(discovered, 'test/architecture/extractable.spec.ts')).toContain(
      "['billing', await discoverContext('billing', new URL('../../src/contexts/billing/', import.meta.url))],",
    );
  });

  it('names the context of knex in the dependency list of a repository', () => {
    const repository = read(discovered, `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`);

    expect(repository).toContain(
      '@Repository(InvoiceRepository, [KnexContext, ExecutionScope, Clock])\nexport class KnexInvoiceRepository implements InvoiceRepository {',
    );

    expect(repository).toContain(
      "import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';",
    );
  });

  it('passes the checker', () => {
    const result = cli(discovered, 'check', '--json').json() as { violations: unknown[] };

    expect(result.violations).toEqual([]);
  });

  it('is accepted behind a broker of the kit: each context listens through the subscriber of its name', () => {
    const behindBroker = tempDir('discovery');

    expect(cli(behindBroker, 'init', '--assembly', 'discovery', '--broker', 'rabbitmq').code).toBe(0);
    expect(cli(behindBroker, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);

    expect(read(behindBroker, 'src/platform/compose-application.ts')).toContain(
      "await discoverContext('billing', new URL('../contexts/billing/', import.meta.url)),",
    );
  });
});
