import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support.js';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, walk, write } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';

const CONFIG = 'ddd-ts-kit.config.json';
const PROJECT_IMPORT = /(?:\bfrom|\bimport\(?)\s*['"]((?:@|\$[a-z][a-z0-9-]*)\/[^'"]*)['"]/g;
const EXTENSION = /\.[cm]?[jt]s$/;

const resolution = (root: string): unknown => {
  const options = jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions');

  return [jsonAt(options, 'module'), jsonAt(options, 'moduleResolution')];
};

describe('init and the extension of an import', () => {
  it('writes no extension by default: the config says "none", tsconfig.json resolves as a bundler, and no import of any kind generated ends with one', () => {
    const root = tempDir('extension');

    scaffoldEverything(root);

    const imports = projectImports(root);

    expect(jsonAt(readJson(root, CONFIG), 'importExtension')).toBe('none');
    expect(Object.keys(Object(readJson(root, CONFIG))).slice(4, 6)).toEqual(['importAlias', 'importExtension']);
    expect(resolution(root)).toEqual(['ESNext', 'Bundler']);
    expect(imports.length).toBeGreaterThan(300);
    expect(imports.filter((specifier) => EXTENSION.test(specifier))).toEqual([]);
    expect(read(root, 'src/main.ts')).toContain("from '@/platform/compose-application';");
    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toMatch(/^export \* from '@\/[^']*[^s]';$/m);

    expect(read(root, 'src/contexts/billing/published-language/index.ts')).toContain(
      "export * from '@/contexts/billing/published-language/invoice-issued.v1.integration-event';",
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('writes ".js" everywhere with --import-extension js: the config, tsconfig.json resolving as Node does, every import of every kind', () => {
    const root = tempDir('extension');

    scaffoldEverything(root, DEFAULT_STACK, ['--import-extension', 'js']);

    const imports = projectImports(root);

    expect(jsonAt(readJson(root, CONFIG), 'importExtension')).toBe('js');
    expect(resolution(root)).toEqual(['NodeNext', 'NodeNext']);
    expect(imports.length).toBeGreaterThan(300);
    expect(imports.filter((specifier) => !specifier.endsWith('.js'))).toEqual([]);
    expect(read(root, 'src/main.ts')).toContain("from '@/platform/compose-application.js';");
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it.each([
    [[], 'never ending in `.js` or `.ts`, and naming a file, never a directory', '"importExtension": "none"'],
    [['--import-extension', 'js'], 'always ending in `.js`', '"importExtension": "js"'],
  ])('says the spelling in the guidance it writes (%j)', (flags, rule, key) => {
    const root = initProject(...flags);

    expect(read(root, 'AGENTS.md')).toContain(rule);
    expect(read(root, 'AGENTS.md')).toContain('`imports/extension`');
    expect(read(root, 'README.md')).toContain(key);
    expect(read(root, 'README.md')).toContain('rewrites each alias of `dist/` into a relative path ending in\n`.js`');
  });

  it('refuses another value before writing anything, with the ones it offers', () => {
    const refused = initFailure('--import-extension', 'ts');

    expect(refused.code).toBe(2);
    expect(refused.message).toBe('Unknown value "ts" for --import-extension.');
    expect(refused.fix).toBe('Use one of: none, js.');
  });

  it('reads a config without the key as "js": a project generated before the key existed keeps its spelling, in check and in what is generated next', () => {
    const root = tempDir('extension');

    scaffoldEverything(root, DEFAULT_STACK, ['--import-extension', 'js']);
    write(root, CONFIG, read(root, CONFIG).replace(/\n\s*"importExtension": "js",/, ''));

    expect(read(root, CONFIG)).not.toContain('importExtension');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
    expect(cli(root, 'generate', 'value-object', 'billing', 'Discount', '--term', 'Discount=A reduction').code).toBe(0);
    const refund = ['command', 'billing', 'RefundInvoice', '--permission', 'invoice.refund'];

    expect(cli(root, 'generate', ...refund, '--term', 'Refund=To give the money back').stderr).toBe('');
    expect(cli(root, 'init').code).toBe(0);
    expect(read(root, CONFIG)).not.toContain('importExtension');
    expect(projectImports(root).filter((specifier) => !specifier.endsWith('.js'))).toEqual([]);
    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toContain('refund-invoice.handler.js');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('reports a value it does not know, and reads it as "js" meanwhile', () => {
    const root = initProject('--import-extension', 'js');

    write(root, CONFIG, read(root, CONFIG).replace('"importExtension": "js"', '"importExtension": "ts"'));

    const found = checkJsonOf(cli(root, 'check', '--json')).violations;

    expect(found.map(({ ruleId, file }) => `${ruleId} ${file}`)).toEqual([`config/valid ${CONFIG}`]);
    expect(found[0]?.message).toBe('"importExtension" is "ts".');
    expect(found[0]?.fix).toContain('Use one of: none, js');
  });
});

/** Every import of a file of the project that the TypeScript sources of the three aliased trees write. */
function projectImports(root: string): string[] {
  return ['src', 'test', 'scripts']
    .flatMap((tree) => walk(root, tree).filter((file) => file.endsWith('.ts')))
    .flatMap((file) => [...read(root, file).matchAll(PROJECT_IMPORT)].map((found) => found[1] ?? ''));
}
