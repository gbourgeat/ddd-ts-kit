import { expect } from 'vitest';
import { cli, type CliResult } from '../helpers';
import { commitAll } from './commit-all';
import { initProject } from './init-project';

export function ok(result: CliResult): CliResult {
  expect(result.code, result.stderr || result.stdout).toBe(0);

  return result;
}

/** A project on `orm` with one aggregate stored and one integration event, committed. */
export function orderingProject(orm: string, ...flags: readonly string[]): string {
  const root = initProject('--orm', orm, '--audit', 'on', '--context', 'ordering:core', ...flags);
  const term = (row: string): string[] => ['--term', row];

  ok(cli(root, 'generate', 'aggregate', 'ordering', 'Order', ...term('Order=A purchase')));
  ok(cli(root, 'generate', 'repository', 'ordering', 'Order'));

  ok(
    cli(
      root,
      'generate',
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
      ...term('Place=Record'),
    ),
  );

  ok(cli(root, 'generate', 'integration-event', 'ordering', 'Order', 'Placed', ...term('Placed=Recorded')));
  commitAll(root);

  return root;
}
