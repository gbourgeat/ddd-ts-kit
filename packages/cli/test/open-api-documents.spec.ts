import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { changeConfig, checkJsonOf } from './check-support';
import { cli, read, scaffoldEverything, tempDir } from './helpers';
import { initProject } from './support/init-project';

const MODULE = 'src/platform/http/openapi-documents.ts';

/**
 * `openapi.documents` splits the contract: `docs` writes the module the contract script and the
 * documentation page read it from, each context resolved into the operations its routes declare.
 * The split itself, a route refused when no document holds it, is proven end to end by
 * e2e/first-class.spec.ts, and by the specs of `routesByDocument` in @ddd-ts-kit/http.
 */
describe('the documents of the contract', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('documents');
    scaffoldEverything(root);
  });

  it('are written by docs, the operations of each context read from its routes, and checked by docs --check', () => {
    changeConfig(root, {
      openapi: {
        documents: [
          { name: 'billing', title: "Billing's API", contexts: ['billing'] },
          { name: 'back-office', groups: ['AuditRoutes'], tags: ['audit'] },
        ],
      },
    });

    expect(cli(root, 'docs', '--check').code).toBe(1);
    expect(cli(root, 'docs').code).toBe(0);

    const written = read(root, MODULE);

    expect(written).toContain("  {\n    name: 'billing',\n    title: \"Billing's API\",\n    operations: [");
    expect(written).toMatch(/operations: \[[^\]]*'issueInvoice'/);

    expect(written).toContain(
      "  {\n    name: 'back-office',\n    groups: ['AuditRoutes'],\n    tags: ['audit'],\n  },\n",
    );

    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(cli(root, 'describe', 'billing', '--json').json()).toMatchObject({ contracts: { openapi: 'openapi/' } });
  });

  it('lays out a list too long for one line one entry per line', () => {
    const tags = Array.from({ length: 12 }, (_, index) => `reporting-area-${index}`);

    changeConfig(root, { openapi: { documents: [{ name: 'reporting', tags }] } });

    expect(cli(root, 'docs').code).toBe(0);
    expect(read(root, MODULE)).toContain("    tags: [\n      'reporting-area-0',\n      'reporting-area-1',\n");
    expect(read(root, MODULE)).toContain("      'reporting-area-11',\n    ],\n  },\n");
  });

  it('notes a split of the contract that the script of the project does not read', () => {
    fs.rmSync(path.join(root, MODULE));
    fs.writeFileSync(path.join(root, 'scripts/openapi.ts'), '// writes the contract of 0.4, whole\n');

    const result = cli(root, 'docs', '--json').json() as { notes: string[] };

    expect(result.notes).toContainEqual(
      expect.stringContaining(
        `"openapi.documents" splits the contract, but scripts/openapi.ts does not read ${MODULE}: compare it with the script \`init\` writes`,
      ),
    );

    expect(fs.existsSync(path.join(root, MODULE))).toBe(false);
  });

  it('are reported by config/valid when one has no name, names nothing or names an unknown context', () => {
    changeConfig(root, {
      openapi: {
        format: 'xml',
        documents: [{ title: 'Nameless', tags: ['audit'] }, { name: 'empty' }, { name: 'ghost', contexts: ['ghost'] }],
      },
    });

    const messages = checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations.map(
      (violation) => violation.message,
    );

    expect(messages).toEqual([
      '"openapi.format" is "xml", a format the contracts are not written in.',
      'The document 1 of "openapi.documents" has the name undefined: it names its file, openapi/<name>.yaml.',
      'The document "empty" names no route group, context or tag: it would hold no route.',
      'The document "ghost" names the context "ghost", which the config does not declare.',
    ]);
  });

  it('point a project whose scripts still write the JSON contract of 0.4 at that file', () => {
    const legacy = initProject('--context', 'billing:core');

    fs.renameSync(path.join(legacy, 'openapi/openapi.yaml'), path.join(legacy, 'openapi/openapi.json'));

    expect(cli(legacy, 'describe', 'billing', '--json').json()).toMatchObject({
      contracts: { openapi: 'openapi/openapi.json' },
    });
  });
});
