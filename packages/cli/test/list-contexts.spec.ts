import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

describe('list, on contexts the config and the disk do not agree on', () => {
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
      'end-to-end specs: none',
    ]);
  });

  it('does not read a dot folder of the contexts directory as a context', () => {
    const root = initProject('--context', 'billing:core');

    fs.mkdirSync(path.join(root, 'src/contexts/.claude/.cc-writes'), { recursive: true });

    const headings = cli(root, 'list')
      .stdout.split('\n')
      .filter((line) => /^\S/.test(line));

    expect(headings).toEqual(['billing [core]', 'end-to-end specs: none']);
  });
});
