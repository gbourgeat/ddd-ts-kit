import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDENTITY_TERMS } from '../src/presets/identity-terms';
import { REPO_ROOT } from './helpers';

/**
 * The page of the plugin that holds the glossary of the identity preset: the glossary step reads
 * it before the bootstrap, when the project has no CLI installed yet to read the preset from.
 */
const PAGE = 'plugin/skills/glossary/identity-preset.md';

describe(`the glossary of the identity preset in ${PAGE}`, () => {
  it('holds the rows the preset writes, in their order, word for word', () => {
    const rows = fs
      .readFileSync(path.join(REPO_ROOT, PAGE), 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Term |'));

    expect(rows).toEqual(IDENTITY_TERMS.map(({ term, meaning }) => `| ${term} | ${meaning} |`));
  });
});
