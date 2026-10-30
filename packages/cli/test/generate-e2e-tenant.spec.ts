import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const SPEC = 'test/e2e/place-order.e2e.spec.ts';

function specOf(...flags: readonly string[]): string {
  const root = initProject(...flags, '--context', 'ordering:core');
  const run = (...args: string[]) => expect(cli(root, 'generate', ...args).code).toBe(0);

  run('aggregate', 'ordering', 'Order', '--term', 'Order=A purchase');
  run('repository', 'ordering', 'Order', ...(flags.length === 0 ? [] : ['--tenant-scoped']));

  run(
    'command',
    'ordering',
    'PlaceOrder',
    '--permission',
    'order.place',
    '--grant',
    'admin',
    '--aggregate',
    'Order',
    '--creates',
    '--term',
    'Place=Record',
  );

  run('route', 'ordering', 'PlaceOrder', '--method', 'POST', '--path', '/orders', '--command');
  run('e2e', 'ordering', 'PlaceOrder');

  return read(root, SPEC);
}

describe('generate e2e', () => {
  it('acts in a tenant where the project is multi-tenant, as a tenant-scoped repository asks', () => {
    const spec = specOf('--tenancy', 'shared-table');

    expect(spec.match(/roles: \['admin'\], tenantId: 'acme' \}/g)).toHaveLength(2);
  });

  it('writes no tenant where the project has none', () => {
    expect(specOf()).not.toContain('tenantId');
  });
});
