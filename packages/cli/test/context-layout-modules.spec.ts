import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MODULE_LAYERS, ROLE_FOLDERS } from '../src/model-modules';
import { checkJsonOf } from './check-support';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write } from './helpers';
import { BILLING, PURPOSE } from './support/project-with-module';

let root: string;
let files: number;

/** Billing with its first module, the files of its layers moved into it: its tests and what belongs to no module still at its own level. */
beforeAll(() => {
  root = tempDir('context-layout-modules');
  scaffoldEverything(root);

  expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', PURPOSE).code).toBe(0);
  expect(cli(root, 'move-to-module', 'billing', 'invoices', ...roleFoldersOfBilling()).code).toBe(0);
  files = walk(root, BILLING).length;
});

describe('a context divided into modules whose tests are still at its own level', () => {
  it('is reported by module/complete as an error whatever its severity, one finding per folder, naming the command that moves it', () => {
    const checked = checkJsonOf(cli(root, 'check', '--rule', 'module/complete', '--json'));
    const earlier = checked.violations.filter(({ severity }) => severity === 'error').map(({ file }) => file);

    expect(earlier).toContain(`${BILLING}/test`);
    expect(new Set(earlier).size).toBe(earlier.length);
    expect(cli(root, 'check', '--rule', 'module/complete').stdout).toContain('npx ddd-ts-kit context-layout billing');
  });

  it('is still read by describe', () => {
    const before = cli(root, 'describe', 'billing', '--json').stdout;

    expect(before).toContain(`${BILLING}/invoices/application/commands/issue-invoice`);
  });

  it('is refused by the generators until it is moved: its new files would sit apart from the others', () => {
    const refused = cli(root, 'generate', 'value-object', 'billing', 'Rebate', '--module', 'invoices', '--allow-name');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toMatch(/still holds .*test\/ at its own level/);
    expect(refused.stderr).toContain('pnpm exec ddd-ts-kit context-layout billing');
  });

  it('takes a second module all the same: declaring one writes no file of a layer', () => {
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
    expect(declared.code).toBe(0);
  });

  it('moves to the tree of today on context-layout, specs, fakes and builders told by their subject or their imports', () => {
    const moved = cli(root, 'context-layout', '--json').json() as { manual: string[] };
    const translator = 'infrastructure/anti-corruption/legacy-erp.translator.ts';

    // What move-to-module was not asked to take stays, listed, and nothing else is left to a person.
    expect(moved.manual.filter((line) => !line.includes('names no module'))).toEqual([
      expect.stringContaining('Run the formatter'),
    ]);

    const laidOut = walk(root, BILLING).map((file) => file.slice(BILLING.length + 1));

    // Every file of the tests is in the module, or in shared/ for what belongs to none.
    expect(laidOut.filter((file) => file.startsWith('test/'))).toEqual([]);
    expect(laidOut).toContain('invoices/test/unit/issue-invoice.handler.spec.ts');
    expect(laidOut.some((file) => file.startsWith('invoices/test/builders/'))).toBe(true);
    expect(laidOut.some((file) => file.startsWith('invoices/test/fakes/'))).toBe(true);
    expect(laidOut).not.toContain(translator);
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');

    expect(
      checkJsonOf(cli(root, 'check', '--rule', 'module/complete', '--json')).violations.filter(
        ({ severity }) => severity === 'error',
      ),
    ).toEqual([]);
  });

  it('lets the generators write again, in the module and in shared', () => {
    const generated = cli(
      root,
      'generate',
      'value-object',
      'billing',
      'Rebate',
      '--module',
      'invoices',
      '--allow-name',
    );

    expect(generated.code, generated.stderr).toBe(0);
    expect(exists(root, `${BILLING}/invoices/domain/value-objects/rebate.vo.ts`)).toBe(true);
    expect(exists(root, `${BILLING}/invoices/test/unit/rebate.vo.spec.ts`)).toBe(true);
    expect(exists(root, `${BILLING}/test`)).toBe(false);
  });
});

describe('context-layout, once the modules hold their tests', () => {
  it('moves nothing more, and loses no file', () => {
    const again = cli(root, 'context-layout', '--json').json() as { moved: unknown[] };

    expect(again.moved).toEqual([]);
    expect(walk(root, BILLING).length).toBeGreaterThanOrEqual(files);
  });

  it('overwrites nothing: a spec left at the level of the context next to the same spec in its module is left to a person', () => {
    const inModule = `${BILLING}/invoices/test/unit/issue-invoice.handler.spec.ts`;
    const left = `${BILLING}/test/unit/invoices/issue-invoice.handler.spec.ts`;
    const kept = read(root, inModule);

    write(root, left, "import { it } from 'vitest';\n\nit.todo('left');\n");

    const moved = cli(root, 'context-layout', '--json').json() as { manual: string[] };

    expect(moved.manual).toContainEqual(
      expect.stringContaining(`${left} and ${inModule} both exist: nothing was overwritten`),
    );

    expect(read(root, inModule)).toBe(kept);
    fs.rmSync(path.join(root, BILLING, 'test'), { recursive: true });
  });

  it('takes a spec of a subfolder of test/unit/ to the module of the file it is named after, at the same depth', () => {
    write(
      root,
      `${BILLING}/test/unit/domain/invoice.aggregate.rules.spec.ts`,
      "import { it } from 'vitest';\n\nit.todo('rules');\n",
    );

    expect(cli(root, 'context-layout').code).toBe(0);
    expect(exists(root, `${BILLING}/invoices/test/unit/domain/invoice.aggregate.rules.spec.ts`)).toBe(true);
  });

  it('lists a file whose imports name two modules, whatever order the files come in', () => {
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
