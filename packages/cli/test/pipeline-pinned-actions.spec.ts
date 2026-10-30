import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';

/** Every `uses:` of the YAML files under a directory, with the file it is in. */
function usesUnder(directory: string): readonly { readonly file: string; readonly line: string }[] {
  return fs.readdirSync(directory, { recursive: true, encoding: 'utf8' }).flatMap((entry) => {
    const file = path.join(directory, entry);

    if (!/\.(yml|yaml|tpl)$/.test(entry) || !fs.statSync(file).isFile()) {
      return [];
    }

    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => /^\s*(?:- )?uses:/.test(line))
      .map((line) => ({ file: entry, line: line.trim() }));
  });
}

/** An action of another repository: by the digest of a commit and the tag it was resolved from; a local action has no tag to move. */
const PINNED = /^(?:- )?uses: (?:\.\/\S+|[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(?:\.\d+)*)$/;

describe('the actions of the GitHub workflows', () => {
  it('are pinned by the digest of a commit with the tag in a comment, in every template and in the source of the pipeline', () => {
    const uses = [
      ...usesUnder(path.join(REPO_ROOT, 'packages/cli/templates/pipeline/github')),
      ...usesUnder(path.join(REPO_ROOT, 'pipeline/github')),
    ];

    expect(uses.length).toBeGreaterThan(30);
    expect(uses.filter(({ line }) => !PINNED.test(line))).toEqual([]);
  });

  it('are pinned by digest in every file init writes, with each opt-in workflow', () => {
    const root = initProject(
      '--ci',
      'github',
      '--ci-extras',
      'codeql,dependency-review,claude-review,claude-triage,intent-to-spec',
    );

    const uses = usesUnder(path.join(root, '.github'));

    expect(uses.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        'workflows/ci.yml',
        'workflows/codeql.yml',
        'workflows/claude-review.yml',
        'workflows/intent-to-spec.yml',
      ]),
    );

    expect(uses.filter(({ line }) => !PINNED.test(line))).toEqual([]);
  });

  it('are kept current by Renovate, which pins what it updates', () => {
    expect(readJson(initProject(), 'renovate.json')).toMatchObject({
      extends: expect.arrayContaining(['helpers:pinGitHubActionDigests']),
    });
  });
});
