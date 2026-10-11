import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { keysAt } from './support/keys-at.js';
import { readJson } from './support/read-json.js';

const OPENAPI = 'openapi/openapi.json';
const ASYNCAPI = 'docs/integration/asyncapi.json';
const CATALOG = 'docs/integration/event-catalog.md';

/**
 * `init` leaves the generated contracts as the scripts of the project write them for a project
 * that has no route and no integration event of its own: the end-to-end suite holds each one to
 * the script (`first-minute-no-context.spec.ts`), these specs to what each stack puts in it.
 */
describe('the contracts init writes', () => {
  it('holds the route of the audit trail behind the bearer scheme, the problem schema, and no event, under the name and version of the manifest', () => {
    const root = initProject();
    const openapi = readJson(root, OPENAPI);
    const manifest = readJson(root, 'package.json');

    expect(jsonAt(openapi, 'info')).toEqual({ title: jsonAt(manifest, 'name'), version: '0.1.0' });
    expect(keysAt(jsonAt(openapi, 'paths'))).toEqual(['/audit/entries']);
    expect(jsonAt(openapi, 'paths', '/audit/entries', 'get', 'security')).toEqual([{ bearer: [] }]);
    expect(keysAt(jsonAt(openapi, 'components', 'schemas'))).toEqual(['Problem']);
    expect(keysAt(jsonAt(openapi, 'components', 'securitySchemes'))).toEqual(['bearer']);
    expect(jsonAt(readJson(root, ASYNCAPI), 'info')).toEqual(jsonAt(openapi, 'info'));
    expect(jsonAt(readJson(root, ASYNCAPI), 'channels')).toEqual({});

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
      const openapi = readJson(initProject(...flags), OPENAPI);

      expect(keysAt(jsonAt(openapi, 'paths'))).toEqual(paths);
      expect(keysAt(jsonAt(openapi, 'components', 'securitySchemes'))).toEqual([scheme]);

      expect(keysAt(openapi)).toEqual(
        paths.length > 0
          ? ['openapi', 'info', 'tags', 'paths', 'components']
          : ['openapi', 'info', 'paths', 'components'],
      );
    },
  );

  it('names the header of the development actor where nobody signs a token', () => {
    const openapi = readJson(initProject('--authn', 'none'), OPENAPI);

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

    expect(jsonAt(readJson(versioned, OPENAPI), 'info')).toEqual({ title: 'orders-api', version: '3.2.1' });
    expect(jsonAt(readJson(bare, ASYNCAPI), 'info')).toMatchObject({ version: '0.0.0' });
    expect(read(bare, 'scripts/openapi.ts')).toContain(`'${String(jsonAt(readJson(bare, OPENAPI), 'info', 'title'))}'`);
  });

  it('leaves a contract that is already there alone, even with --force: the scripts of the project keep it current', () => {
    const root = initProject();

    write(root, OPENAPI, '{ "paths": { "/invoices": {} } }\n');
    write(root, CATALOG, '# Event catalog\n\n## billing.invoice.issued\n');

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(read(root, OPENAPI)).toBe('{ "paths": { "/invoices": {} } }\n');
    expect(read(root, CATALOG)).toBe('# Event catalog\n\n## billing.invoice.issued\n');
  });
});
