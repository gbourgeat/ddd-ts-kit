import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

describe('list', () => {
  it('says which context is missing on disk and which is missing from the config', () => {
    const root = initProject('--context', 'billing:core');
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, unknown> };

    config.contexts['ghost'] = { classification: 'generic', upstreams: [] };
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));
    fs.mkdirSync(path.join(root, 'src/contexts/orphan/domain'), { recursive: true });

    const headings = cli(root, 'list')
      .stdout.split('\n')
      .filter((line) => /^\S/.test(line));

    expect(headings).toEqual([
      'billing [core]',
      'ghost [generic] (missing on disk)',
      'orphan [undeclared] (missing from the config)',
    ]);
  });

  it('does not read a dot folder of the contexts directory as a context', () => {
    const root = initProject('--context', 'billing:core');

    fs.mkdirSync(path.join(root, 'src/contexts/.claude/.cc-writes'), { recursive: true });

    const headings = cli(root, 'list')
      .stdout.split('\n')
      .filter((line) => /^\S/.test(line));

    expect(headings).toEqual(['billing [core]']);
  });

  it('prints only the kinds a context holds, where --json keeps every key', () => {
    const root = initProject('--context', 'billing:core');

    const printed = cli(root, 'list').stdout;
    const listed = jsonAt(cli(root, 'list', '--json').json(), 'contexts', '0');

    expect(printed).toBe(
      'billing [core]\n  glossary: empty (define the ubiquitous language first)\n  deployable alone: no',
    );

    expect(printed).not.toContain('none');
    expect(listed).toEqual(expect.objectContaining({ aggregates: [], commands: [], permissions: [] }));
  });
});
