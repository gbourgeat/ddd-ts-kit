import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

describe('the generated TypeORM schema', () => {
  it('says that a jsonb field is not typed Record<string, unknown>, with and without a tenant', () => {
    for (const tenant of [[], ['--tenant-scoped']]) {
      const root = initProject('--orm', 'typeorm', '--context', 'billing:core', '--audit', 'off');

      cli(root, 'generate', 'aggregate', 'billing', 'Order', '--term', 'Order=an order');
      cli(root, 'generate', 'repository', 'billing', 'Order', ...tenant);

      expect(read(root, 'src/contexts/billing/infrastructure/persistence/billing.schema.ts')).toContain(
        'A jsonb field is typed with a named interface or `object`, never `Record<string, unknown>`',
      );
    }
  });
});
