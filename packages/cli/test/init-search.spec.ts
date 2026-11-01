import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { KIT_RANGE } from './support/kit-range';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

const searchOf = (root: string): unknown => jsonAt(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack'), 'search');

describe('init --search', () => {
  it('records opensearch in the stack and installs the store of the kit', () => {
    const root = initProject('--search', 'opensearch');

    expect(searchOf(root)).toBe('opensearch');

    expect(textsAt(readJson(root, 'package.json'), 'dependencies')).toMatchObject({
      '@ddd-ts-kit/opensearch': KIT_RANGE,
    });
  });

  it.each([[[]], [['--search', 'none']]])('records none and installs nothing of OpenSearch with %j', (flags) => {
    const root = initProject(...flags);

    expect(searchOf(root)).toBe('none');
    expect(textsAt(readJson(root, 'package.json'), 'dependencies')).not.toHaveProperty('@ddd-ts-kit/opensearch');
    expect(exists(root, 'src/platform/search')).toBe(false);
  });

  it('refuses a value outside the list, with the values it takes', () => {
    const refused = initFailure('--search', 'elasticsearch');

    expect(refused.code).toBe(2);
    expect(refused.message).toBe('Unknown value "elasticsearch" for --search.');
    expect(refused.fix).toBe('Use one of: none, opensearch.');
  });

  it('keeps the recorded choice through init --force, and changes it when the flag names another', () => {
    const root = initProject('--search', 'opensearch');

    commitAll(root);
    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(searchOf(root)).toBe('opensearch');

    commitAll(root);
    expect(cli(root, 'init', '--force', '--search', 'none').code).toBe(0);
    expect(searchOf(root)).toBe('none');
  });

  it('reads a config that says nothing of search as none', () => {
    const root = initProject();
    const config = readJson(root, 'ddd-ts-kit.config.json');
    const { search: _left, ...stack } = jsonAt(config, 'stack') as Record<string, unknown>;

    write(root, 'ddd-ts-kit.config.json', `${JSON.stringify({ ...(config as object), stack }, null, 2)}\n`);
    commitAll(root);

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(searchOf(root)).toBe('none');
  });
});

describe('what init --search opensearch writes', () => {
  it('reads the node and the user of the security plugin, both or neither', () => {
    const root = initProject('--search', 'opensearch');
    const loadConfig = platform(root, 'config/load-config.ts');

    expect(loadConfig).toContain('    search: readSearch(env),\n');
    expect(loadConfig).toContain("    node: env.url('OPENSEARCH_URL'),\n");

    expect(loadConfig).toContain(
      "env.problem('OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD must be set together, or neither');",
    );

    expect(platform(root, 'config/app-config.ts')).toContain('  readonly search: SearchConfig;\n');
    expect(read(root, 'src/main.ts')).toContain('    search: config.search,\n');
  });

  it('gives every context SearchIndexes, bound by the container and provisioned at the start', () => {
    const root = initProject('--search', 'opensearch');

    expect(platform(root, 'search/search-indexes.ts')).toContain('export abstract class SearchIndexes {');

    expect(platform(root, 'search/open-search.ts')).toContain(
      "return new ProvisionedIndexes(transport, { strategy: 'none' }, []);",
    );

    expect(platform(root, 'search/search.module.ts')).toContain('builder.bind(SearchIndexes).toValue(search);');
    expect(platform(root, 'search/search.module.ts')).toContain('onStart: () => search.provision(),');
    expect(platform(root, 'composition/compose-application.ts')).toContain('      searchModule(foundations.search),\n');
  });

  it('hands it to each context on the platform wired by hand, and provisions before the events flow', () => {
    const root = initProject('--search', 'opensearch', '--di', 'manual');

    expect(exists(root, 'src/platform/search/search.module.ts')).toBe(false);
    expect(platform(root, 'composition/platform.ts')).toContain('  readonly search: SearchIndexes;\n');

    expect(platform(root, 'composition/compose-application.ts')).toContain(
      '  await platform.search.provision();\n  await options.events.start();\n',
    );
  });

  it('keeps the tenants of a store apart by a filtered alias under shared tables', () => {
    const root = initProject('--search', 'opensearch', '--tenancy', 'shared-table');

    expect(platform(root, 'search/open-search.ts')).toContain(
      "return new ProvisionedIndexes(transport, { strategy: 'attribute', scope }, tenants);",
    );

    expect(platform(root, 'composition/lay-foundations.ts')).toContain(
      'search: openSearch(options.search, { scope, tenants: options.tenants ?? [] }),',
    );
  });

  it('starts a node in the compose stack and names its variables', () => {
    const root = initProject('--search', 'opensearch');
    const compose = read(root, 'docker-compose.yml');

    expect(compose).toContain('  opensearch:\n    image: opensearchproject/opensearch:3@sha256:');
    expect(compose).toContain('      DISABLE_SECURITY_PLUGIN: "true"\n');
    expect(compose).toContain('      - "127.0.0.1:${OPENSEARCH_PORT:-9200}:9200"\n');
    expect(compose).toContain('  opensearch-data:\n');
    expect(read(root, '.env.example')).toContain('OPENSEARCH_URL=http://localhost:9200\n');

    expect(read(root, 'README.md')).toContain(
      '| `OPENSEARCH_URL` | the node, or the load balancer in front of the cluster: required |',
    );
  });

  it('writes none of it without the flag', () => {
    const root = initProject();

    expect(read(root, 'docker-compose.yml')).not.toContain('opensearch');
    expect(read(root, '.env.example')).not.toContain('OPENSEARCH');
    expect(platform(root, 'config/load-config.ts')).not.toContain('readSearch');
    expect(platform(root, 'composition/compose-application.ts')).not.toContain('search');
  });
});
