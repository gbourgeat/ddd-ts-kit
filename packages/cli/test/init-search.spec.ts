import { describe, expect, it } from 'vitest';
import { cli, exists, write } from './helpers';
import { commitAll } from './support/commit-all';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { KIT_RANGE } from './support/kit-range';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

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
