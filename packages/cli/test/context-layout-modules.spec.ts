import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { moveFiles } from '../src/file-moves';
import { MODULE_LAYERS, ROLE_FOLDERS } from '../src/model-modules';
import { Workspace } from '../src/workspace';
import { checkJsonOf } from './check-support';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write } from './helpers';
import { BILLING, PURPOSE } from './support/project-with-module';

let root: string;
let today: string[];

beforeAll(() => {
  root = tempDir('context-layout-modules');
  scaffoldEverything(root);

  expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', PURPOSE).code).toBe(0);
  expect(cli(root, 'move-to-module', 'billing', 'invoices', ...roleFoldersOfBilling()).code).toBe(0);
  expect(cli(root, 'docs').code).toBe(0);

  today = walk(root, BILLING).sort();
  toTheLayoutOf086();
});

describe('a context whose module sits where 0.86 and 0.87 put it', () => {
  it('is read, and module/complete warns about it, naming the command that moves it', () => {
    const checked = checkJsonOf(cli(root, 'check', '--rule', 'module/complete', '--json'));

    expect(checked.violations.map(({ file, severity }) => `${severity} ${file}`)).toContain(
      `warn ${BILLING}/domain/invoices`,
    );

    expect(cli(root, 'check', '--rule', 'module/complete').stdout).toContain('npx ddd-ts-kit context-layout billing');
  });

  it('is still read by describe, its use cases where 0.86 and 0.87 put them', () => {
    const described = cli(root, 'describe', 'billing', '--json').stdout;

    expect(described).toContain(`${BILLING}/application/invoices/commands/issue-invoice`);
    expect(described).toContain(`${BILLING}/domain/invoices/repositories/invoice.repository.ts`);
  });

  it('is refused by move-to-module, as by the generators', () => {
    const refused = cli(root, 'move-to-module', 'billing', 'invoices', 'domain/aggregates');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('pnpm exec ddd-ts-kit context-layout billing');
  });

  it('is refused by the generators until it is moved: its new files would sit apart from their module', () => {
    const refused = cli(root, 'generate', 'value-object', 'billing', 'Rebate', '--module', 'invoices', '--allow-name');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('pnpm exec ddd-ts-kit context-layout billing');
  });

  it('moves to the tree of today on context-layout, adapters, routes and specs told by their imports', () => {
    const moved = cli(root, 'context-layout', '--json').json() as { manual: string[] };
    const translator = 'infrastructure/anti-corruption/legacy-erp.translator.ts';

    // The translator imports nothing of a module and nothing of one imports it: listed, left where it is, its spec with it.
    expect(moved.manual).toEqual([
      expect.stringContaining(`${BILLING}/${translator} names no module`),
      expect.stringContaining(`${BILLING}/test/integration/legacy-erp.translator.spec.ts names no module`),
      expect.stringContaining('Run the formatter'),
    ]);

    expect(walk(root, BILLING).sort()).toEqual(
      today
        .map((file) =>
          file
            .replace(`${BILLING}/invoices/${translator}`, `${BILLING}/${translator}`)
            .replace('/test/integration/invoices/legacy-erp', '/test/integration/legacy-erp'),
        )
        .sort(),
    );

    const checkedDocs = cli(root, 'docs', '--check');

    expect(checkedDocs.stdout).toBe('The generated documentation is up to date.');

    expect(
      checkJsonOf(cli(root, 'check', '--rule', 'module/complete', '--json')).violations.map(({ file }) => file),
    ).toEqual([`${BILLING}/infrastructure/anti-corruption`]);
  });
});

describe('context-layout, once the modules are in their folders', () => {
  it('overwrites nothing: a file of 0.86 or 0.87 next to the same file in its module is left to a person', () => {
    const today = `${BILLING}/invoices/domain/aggregates/invoice.aggregate.ts`;
    const earlier = `${BILLING}/domain/invoices/aggregates/invoice.aggregate.ts`;
    const kept = read(root, today);

    write(root, earlier, 'export class Invoice {}\n');

    const moved = cli(root, 'context-layout', '--json').json() as { manual: string[] };

    expect(moved.manual).toContainEqual(
      expect.stringContaining(`${earlier} and ${today} both exist: nothing was overwritten`),
    );

    expect(read(root, today)).toBe(kept);
    fs.rmSync(path.join(root, earlier));
  });

  it('takes a spec of a subfolder of test/unit/ to the module of the file it is named after, at the same depth', () => {
    write(
      root,
      `${BILLING}/test/unit/domain/invoice.aggregate.rules.spec.ts`,
      "import { it } from 'vitest';\n\nit.todo('rules');\n",
    );

    expect(cli(root, 'context-layout').code).toBe(0);
    expect(exists(root, `${BILLING}/test/unit/invoices/domain/invoice.aggregate.rules.spec.ts`)).toBe(true);
  });

  it('lists a file whose imports name two modules, whatever order the files come in', () => {
    const declared = cli(
      root,
      'generate',
      'module',
      'billing',
      'payments',
      '--purpose',
      'The payments of the invoices.',
      '--term',
      'Payment=Money received for an invoice',
    );

    expect(declared.stderr).toBe('');

    write(root, `${BILLING}/payments/domain/value-objects/payment-term.vo.ts`, 'export const paymentTerm = 30;\n');

    write(
      root,
      `${BILLING}/infrastructure/persistence/a-combo.mapper.ts`,
      "import { invoiceIssued } from '@/contexts/billing/invoices/domain/events/invoice-issued.event';\nimport { helper } from './b-helper.mapper';\n\nexport const combo = [invoiceIssued, helper];\n",
    );

    write(
      root,
      `${BILLING}/infrastructure/persistence/b-helper.mapper.ts`,
      "import { paymentTerm } from '@/contexts/billing/payments/domain/value-objects/payment-term.vo';\n\nexport const helper = paymentTerm;\n",
    );

    const moved = cli(root, 'context-layout', '--json').json() as { manual: string[] };

    expect(moved.manual).toContainEqual(
      expect.stringContaining(`${BILLING}/infrastructure/persistence/a-combo.mapper.ts names no module, or two`),
    );

    expect(exists(root, `${BILLING}/payments/infrastructure/persistence/b-helper.mapper.ts`)).toBe(true);
  });
});

/** Every role folder of the layers of billing, relative to the context. */
function roleFoldersOfBilling(): string[] {
  return MODULE_LAYERS.flatMap((layer) =>
    fs
      .readdirSync(path.join(root, BILLING, layer))
      .filter((folder) => ROLE_FOLDERS[layer]?.includes(folder) === true)
      .map((folder) => `${layer}/${folder}`),
  );
}

/**
 * Lays the module out as 0.86 and 0.87 did: its model and its use cases under `domain/invoices/` and
 * `application/invoices/`, its adapters, routes and specs at the level of the context.
 */
function toTheLayoutOf086(): void {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);
  const prefix = `${BILLING}/`;

  const moves = walk(root, BILLING).flatMap((file) => {
    const relative = file.slice(prefix.length);
    const earlier = earlierPlaceOf(relative);

    return earlier === relative || relative.endsWith('.declarations.ts')
      ? []
      : [{ from: file, to: `${prefix}${earlier}` }];
  });

  moveFiles(ws, config, moves);
  ws.pruneEmptiedFolders();
  ws.commit(false);
}

function earlierPlaceOf(relative: string): string {
  const [first, layer = '', ...rest] = relative.split('/');

  if (first === 'invoices') {
    return layer === 'domain' || layer === 'application'
      ? [layer, 'invoices', ...rest].join('/')
      : [layer, ...rest].join('/');
  }

  return relative.replace(/^test\/(unit|integration)\/invoices\//, 'test/$1/');
}
