import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const LIST = 'src/platform/database/read-model-tables.ts';

/**
 * A committed project of the given flags whose scripts stand for the real ones: billing holds the
 * read model InvoiceSummaries on the trunk, and the branch of a slice of shipping is checked out.
 */
function shippingSlice(name: string, ...flags: readonly string[]): string {
  const root = committedProject(
    name,
    '--context',
    'billing:core',
    '--context',
    'shipping:supporting',
    '--package-manager',
    'npm',
    ...flags,
  );

  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  manifest.scripts['test'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  expectOk(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries'));
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'feat(billing): invoice summaries');
  git(root, 'switch', '--quiet', '--create', 'build/shipping');

  return root;
}

function plan(root: string): { toStage: unknown; leftOut: unknown } {
  const verification = cli(root, 'verify-slice', 'shipping', '--since', 'main', '--json').json();

  return { toStage: jsonAt(verification, 'toStage'), leftOut: jsonAt(verification, 'leftOut') };
}

describe('verify-slice counts the list of the read model tables the slice joined', () => {
  it.each(['drizzle', 'knex', 'prisma', 'typeorm'])(
    'stages on %s the list a read model of the slice joined, alone or under the alias of a name another context holds',
    (orm) => {
      const root = shippingSlice(`list-${orm}`, '--orm', orm);

      expectOk(cli(root, 'generate', 'read-model', 'shipping', 'ParcelsToSend'));

      expect(read(root, LIST)).toMatch(/\['shipping', \w+ParcelsToSend\],/);
      expect(plan(root)).toEqual({ toStage: expect.arrayContaining([LIST]), leftOut: [] });

      expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));

      expect(read(root, LIST)).toMatch(/\['shipping', Shipping\w+InvoiceSummaries\],/);
      expect(plan(root)).toEqual({ toStage: expect.arrayContaining([LIST]), leftOut: [] });
    },
  );

  it('stages the list of a project whose imports start with another alias', () => {
    const root = shippingSlice('list-alias', '--orm', 'knex', '--import-alias', '$app/');

    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'ParcelsToSend'));

    expect(read(root, LIST)).toContain("from '$app/contexts/shipping/");
    expect(plan(root)).toEqual({ toStage: expect.arrayContaining([LIST]), leftOut: [] });
  });

  it('leaves the list out once it holds a change of another context, or of the platform', () => {
    const root = shippingSlice('list-left-out', '--orm', 'knex');

    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));

    const generated = read(root, LIST);

    write(root, LIST, generated.replace("['billing', KnexInvoiceSummaries],\n", ''));

    expect(plan(root).leftOut).toEqual([LIST]);

    write(root, LIST, generated.replace('const NOT_LISTED', 'const LEFT_OUT'));

    expect(plan(root).leftOut).toEqual([LIST]);
  });

  it('leaves the schema index out when the line that keeps a shared name names a module that is no tables file holding it', () => {
    const root = shippingSlice('index-kept-line', '--orm', 'drizzle');
    const index = 'src/platform/database/schema.ts';
    const kept = "export { invoiceSummaries } from '@/contexts/billing/infrastructure/persistence/billing.schema';";

    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'InvoiceSummaries'));

    expect(read(root, index)).toContain(kept);
    expect(plan(root).leftOut).toEqual([]);

    write(root, index, read(root, index).replace(kept, "export { invoiceSummaries } from '@/platform/elsewhere';"));

    expect(plan(root).leftOut).toEqual([index]);
  });
});
