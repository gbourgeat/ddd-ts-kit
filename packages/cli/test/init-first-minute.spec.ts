import { describe, expect, it } from 'vitest';
import { cli, exists, EXPLICIT_STACK, read, tempDir, walk, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';

const COMPOSITION = 'src/platform/compose-application.ts';
const PROOF = 'test/architecture/extractable.spec.ts';
const OWN_POLICY = 'src/platform/resilience/own-policy.ts';

/**
 * Nothing `init` writes waits for a later command to be used: what only the first context or
 * the first adapter names arrives with it, so that the linter and the dead-code gate of a
 * project pass from its first minute. The end-to-end suite runs those gates for real
 * (`first-minute.spec.ts`).
 */
describe('a project before its first context', () => {
  it('has a spec to run: the platform wires alone, in the proof each context then joins', () => {
    for (const flags of [[], ['--style', 'explicit'], ['--di', 'manual']]) {
      const proof = read(initProject(...flags), PROOF);

      expect(proof).toContain("it('the platform wires alone, before the first context joins it', () => {");
      expect(proof).toContain('// ddd-ts-kit:contexts\n  // /ddd-ts-kit:contexts');
    }
  });

  it.each([
    [[], 'contextModule'],
    [['--assembly', 'discovery'], 'discoverContext'],
  ])('imports what assembles a declared context with the first one, and once (%j)', (flags, assembler) => {
    const root = initProject(...flags);
    const statement = new RegExp(`^import [^;]*\\b${assembler}\\b[^;]*;$`, 'gm');
    const imports = (file: string): number => [...read(root, file).matchAll(statement)].length;

    expect([COMPOSITION, PROOF].map(imports)).toEqual([0, 0]);

    context(root, 'billing');
    context(root, 'shipping');

    expect([COMPOSITION, PROOF].map(imports)).toEqual([1, 1]);
    expect(read(root, COMPOSITION)).toContain(`${assembler}('billing', `);
  });

  it('writes the same project whether a context is asked of init or generated right after it', () => {
    const asked = tempDir('asked');
    const generated = initProject();

    cli(asked, 'init', '--context', 'billing:core');
    context(generated, 'billing');

    expect(walk(generated)).toEqual(walk(asked));

    // Each directory gives its project a name of its own: what is compared is said for one name.
    const text = (root: string, file: string): string =>
      read(root, file).replaceAll(String(jsonAt(readJson(root, 'package.json'), 'name')), 'app');

    for (const file of walk(asked)) {
      expect(text(generated, file), file).toBe(text(asked, file));
    }
  });

  it('adds the import in the region of a file whose import of the package was rewritten, and leaves a file that has it alone', () => {
    const root = initProject();

    const rewritten = read(root, PROOF).replace(
      "import { createTestApplication, type ContextModule } from '@ddd-ts-kit/di';",
      "import * as di from '@ddd-ts-kit/di';",
    );

    write(root, PROOF, rewritten);

    write(
      root,
      COMPOSITION,
      read(root, COMPOSITION).replace('  createApplication,\n', '  contextModule,\n  createApplication,\n'),
    );

    context(root, 'billing');

    expect(read(root, PROOF)).toContain(
      "// ddd-ts-kit:imports\nimport { contextModule } from '@ddd-ts-kit/di';\nimport * as billingDeclarations",
    );

    expect(read(root, COMPOSITION).split('contextModule,\n')).toHaveLength(2);
  });
});

describe('the helper an adapter states its own policy with', () => {
  it('is written by init where the platform itself uses it: wired by hand', () => {
    expect(exists(initProject(), OWN_POLICY)).toBe(false);
    expect(exists(initProject('--style', 'explicit'), OWN_POLICY)).toBe(false);
    expect(read(initProject('--di', 'manual'), OWN_POLICY)).toContain('export function ownPolicy(');
    expect(read(initProject('--http', 'nest'), OWN_POLICY)).toContain('export function ownPolicy(');
  });

  it.each([
    ['declared', []],
    ['explicit', ['--style', 'explicit']],
  ])('joins a %s platform with the first adapter that names it, and is left alone by the next', (_style, flags) => {
    const root = initProject(...flags, '--context', 'billing:core');

    expect(stringsAt(adapter(root, 'PaymentGateway').json(), 'created')).toContain(OWN_POLICY);
    expect(read(root, OWN_POLICY)).toContain("import { selfGoverned } from '@/platform/resilience/self-governed';");

    write(root, OWN_POLICY, `${read(root, OWN_POLICY)}// kept\n`);

    const second = adapter(root, 'TaxRates', '--decorators').json();

    expect([...stringsAt(second, 'created'), ...stringsAt(second, 'updated')]).not.toContain(OWN_POLICY);
    expect(read(root, OWN_POLICY)).toContain('// kept');
  });

  it('is a shared file: a worker confined to its context gets the first adapter refused, and the next ones through', () => {
    const root = initProject('--context', 'billing:core');
    const refused = adapter(root, 'PaymentGateway', '--local-only');

    expect(refused.code).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(OWN_POLICY);
    expect(adapter(root, 'PaymentGateway').code).toBe(0);
    expect(adapter(root, 'TaxRates', '--local-only').code).toBe(0);
  });

  it('stays out of a project whose port is already bound: the note says where the remote adapter goes', () => {
    const root = tempDir('bound');

    cli(root, 'init', ...Object.entries(EXPLICIT_STACK).flatMap(([key, value]) => [`--${key}`, String(value)]));
    context(root, 'billing');
    cli(root, 'generate', 'port', 'billing', 'PaymentGateway', '--allow-name');

    const module = 'src/contexts/billing/billing.module.ts';

    write(
      root,
      module,
      read(root, module).replace(
        '// /ddd-ts-kit:registrations',
        'builder.bind(PaymentGateway);\n    // /ddd-ts-kit:registrations',
      ),
    );

    const result = cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--allow-name', '--json');

    expect(stringsAt(result.json(), 'notes').join('\n')).toContain('PaymentGateway is already bound');
    expect(exists(root, OWN_POLICY)).toBe(false);
  });
});

describe('the migrations of a project that has generated none', () => {
  it('start, with drizzle, from the journal of drizzle-kit and no entry: applying them applies nothing instead of failing', () => {
    const journal = readJson(initProject(), 'migrations/meta/_journal.json');

    expect(journal).toEqual({ version: '7', dialect: 'postgresql', entries: [] });
    expect(exists(initProject('--orm', 'knex'), 'migrations/meta/_journal.json')).toBe(false);
    expect(read(initProject(), 'biome.json')).toContain('"!**/migrations/meta"');
  });
});

describe('what init says to do next', () => {
  it.each([
    [[], 'Run `pnpm install`, then `pnpm run verify`.'],
    [['--package-manager', 'npm'], 'Run `npm install`, then `npm run verify`.'],
  ])('is the install and the whole gate, in the words of the package manager (%j)', (flags, note) => {
    const result = cli(tempDir('note'), 'init', ...flags, '--json');

    expect(stringsAt(result.json(), 'notes')).toContain(note);
  });
});

function context(root: string, name: string, ...more: string[]): void {
  expect(cli(root, 'generate', 'context', name, '--classification', 'core', ...more).stderr).toBe('');
}

/** A port of billing and its remote adapter, the way a team asks for them; answers the result of the adapter. */
function adapter(root: string, port: string, ...more: string[]): ReturnType<typeof cli> {
  cli(root, 'generate', 'port', 'billing', port, '--allow-name');

  return cli(root, 'generate', 'adapter', 'billing', port, '--allow-name', '--json', ...more);
}
