import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { keysAt } from './support/keys-at';
import { readContract } from './support/read-contract';
import { readJson } from './support/read-json';

const OPENAPI = 'openapi/openapi.yaml';
const ASYNCAPI = 'docs/integration/asyncapi.yaml';
const CATALOG = 'docs/integration/event-catalog.md';

/**
 * `init` leaves the generated contracts as the scripts of the project write them for a project
 * that has no route and no integration event of its own: the end-to-end suite holds each one to
 * the script (`first-minute-no-context.spec.ts`), these specs to what each stack puts in it.
 */
describe('the contracts init writes', () => {
  it('holds the route of the audit trail behind the bearer scheme, the problem schema, and no event, under the name and version of the manifest', () => {
    const root = initProject();
    const openapi = readContract(root, OPENAPI);
    const manifest = readJson(root, 'package.json');

    expect(jsonAt(openapi, 'info')).toEqual({ title: jsonAt(manifest, 'name'), version: '0.1.0' });
    expect(keysAt(jsonAt(openapi, 'paths'))).toEqual(['/audit/entries']);
    expect(jsonAt(openapi, 'paths', '/audit/entries', 'get', 'security')).toEqual([{ bearer: [] }]);
    expect(keysAt(jsonAt(openapi, 'components', 'schemas'))).toEqual(['Problem']);
    expect(keysAt(jsonAt(openapi, 'components', 'securitySchemes'))).toEqual(['bearer']);
    expect(jsonAt(readContract(root, ASYNCAPI), 'info')).toEqual(jsonAt(openapi, 'info'));
    expect(jsonAt(readContract(root, ASYNCAPI), 'channels')).toEqual({});

    expect(read(root, CATALOG)).toBe(
      '# Event catalog\n\nGenerated from the integration event declarations. Do not edit by hand: regenerate.\n',
    );
  });

  it.each([
    [['--audit', 'off'], [], 'bearer'],
    [['--authn', 'none'], ['/audit/entries'], 'developmentActor'],
    [['--orm', 'none', '--authn', 'keycloak'], [], 'bearer'],
  ])(
    'follows the stack (%j): the audit route only when the trail has one, the scheme of the authentication',
    (flags, paths, scheme) => {
      const openapi = readContract(initProject(...flags), OPENAPI);

      expect(keysAt(jsonAt(openapi, 'paths'))).toEqual(paths);
      expect(keysAt(jsonAt(openapi, 'components', 'securitySchemes'))).toEqual([scheme]);

      expect(keysAt(openapi)).toEqual(
        paths.length > 0
          ? ['openapi', 'info', 'tags', 'paths', 'components']
          : ['openapi', 'info', 'paths', 'components'],
      );
    },
  );

  it('documents 406 on the audit route of a project that negotiates its representations, and not otherwise', () => {
    const statuses = (root: string) =>
      keysAt(jsonAt(readContract(root, OPENAPI), 'paths', '/audit/entries', 'get', 'responses'));

    expect(statuses(initProject())).toEqual(['200', '401', '403', '406', '422']);
    expect(statuses(initProject('--representations', 'json'))).toEqual(['200', '401', '403', '422']);
  });

  it('names the header of the development actor where nobody signs a token', () => {
    const openapi = readContract(initProject('--authn', 'none'), OPENAPI);

    expect(jsonAt(openapi, 'components', 'securitySchemes', 'developmentActor')).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'x-development-actor',
    });

    expect(jsonAt(openapi, 'paths', '/audit/entries', 'get', 'security')).toEqual([{ developmentActor: [] }]);
  });

  it('writes no HTTP contract without an HTTP boundary, and the two documents of the events all the same', () => {
    const root = initProject('--http', 'none');

    expect(exists(root, OPENAPI)).toBe(false);
    expect(exists(root, ASYNCAPI)).toBe(true);
    expect(exists(root, CATALOG)).toBe(true);
  });

  it('takes the title and the version from the manifest of an existing project, as the scripts do', () => {
    const versioned = tempDir('contracts');
    const bare = tempDir('contracts');

    write(versioned, 'package.json', JSON.stringify({ name: 'orders-api', version: '3.2.1' }));
    write(bare, 'package.json', JSON.stringify({ private: true }));
    cli(versioned, 'init');
    cli(bare, 'init');

    expect(jsonAt(readContract(versioned, OPENAPI), 'info')).toEqual({ title: 'orders-api', version: '3.2.1' });
    expect(jsonAt(readContract(bare, ASYNCAPI), 'info')).toMatchObject({ version: '0.0.0' });

    expect(read(bare, 'scripts/openapi.ts')).toContain(
      `'${String(jsonAt(readContract(bare, OPENAPI), 'info', 'title'))}'`,
    );
  });

  it('leaves a contract that is already there alone, even with --force: the scripts of the project keep it current', () => {
    const root = initProject();

    write(root, OPENAPI, 'paths:\n  /invoices: {}\n');
    write(root, CATALOG, '# Event catalog\n\n## billing.invoice.issued\n');

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(read(root, OPENAPI)).toBe('paths:\n  /invoices: {}\n');
    expect(read(root, CATALOG)).toBe('# Event catalog\n\n## billing.invoice.issued\n');
  });

  it('writes them in YAML by default, in JSON when the config asks for it, and no file of the other format', () => {
    const [yaml, json] = [tempDir('contracts'), tempDir('contracts')];

    for (const root of [yaml, json]) {
      write(root, 'package.json', JSON.stringify({ name: 'orders-api', version: '3.2.1' }));
    }

    // Both configs exist, so both projects keep what an absent key says (no negotiation): only the format differs.
    write(yaml, 'ddd-ts-kit.config.json', JSON.stringify({}));
    write(json, 'ddd-ts-kit.config.json', JSON.stringify({ openapi: { format: 'json' } }));
    expect([cli(yaml, 'init').code, cli(json, 'init').code]).toEqual([0, 0]);

    expect(read(yaml, OPENAPI)).toMatch(/^openapi: '3\.1\.0'\ninfo:\n {2}title: orders-api\n/);
    expect(exists(yaml, 'openapi/openapi.json')).toBe(false);
    expect(readJson(json, 'openapi/openapi.json')).toEqual(readContract(yaml, OPENAPI));
    expect(readJson(json, 'docs/integration/asyncapi.json')).toEqual(readContract(yaml, ASYNCAPI));
    expect(exists(json, OPENAPI)).toBe(false);
    expect(read(json, 'openapi/openapi.json')).toMatch(/^\{\n {2}"openapi": "3\.1\.0",\n/);
  });

  it('writes the module of the split of the contract, empty: one document', () => {
    expect(read(initProject(), 'src/platform/http/openapi-documents.ts')).toBe(
      '// Generated by `ddd-ts-kit docs` from "openapi.documents" of ddd-ts-kit.config.json: never edit it.\nimport type { OpenApiDocumentSelection } from \'@ddd-ts-kit/http/openapi\';\n\nexport const OPENAPI_DOCUMENTS: readonly OpenApiDocumentSelection[] = [];\n',
    );
  });
});

describe('the contracts of a preset', () => {
  it('are marked to be written by the first check of their scripts, which write them there and fail on a pipeline', () => {
    const preset = initProject('--preset', 'identity');
    const bare = initProject();
    const pending = 'Written by the first `docs:check` or `docs:generate`.';

    expect(jsonAt(readContract(preset, OPENAPI), 'x-ddd-ts-kit-pending')).toBe(pending);
    expect(jsonAt(readContract(preset, ASYNCAPI), 'x-ddd-ts-kit-pending')).toBe(pending);
    expect(read(preset, CATALOG)).toContain(`<!-- x-ddd-ts-kit-pending: ${pending} -->`);

    expect([OPENAPI, ASYNCAPI, CATALOG].filter((file) => read(bare, file).includes('x-ddd-ts-kit-pending'))).toEqual(
      [],
    );

    for (const script of ['scripts/openapi.ts', 'scripts/events.ts']) {
      expect(read(preset, script)).toContain('if (committed.includes(PENDING)) {\n      writeFirst(file, content);');
      expect(read(preset, script)).toContain("if (process.env['CI'] !== undefined) {");
    }
  });
});
