import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT, walk } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';

interface Use {
  readonly file: string;
  readonly line: string;
}

interface Pin {
  readonly file: string;
  readonly digest: string;
  readonly tag: string;
}

/** Every `uses:` of the YAML files under a directory, with the file it is in (relative to the directory). */
function usesUnder(directory: string): readonly Use[] {
  return walk(directory)
    .filter((entry) => /\.(yml|yaml|tpl)$/.test(entry))
    .flatMap((entry) =>
      fs
        .readFileSync(path.join(directory, entry), 'utf8')
        .split('\n')
        .filter((line) => /^\s*(?:- )?uses:/.test(line))
        .map((line) => ({ file: entry, line: line.trim() })),
    );
}

/** An action of another repository: by the digest of a commit and the tag it was resolved from; a local action has no tag to move. */
const PINNED = /^(?:- )?uses: (?:\.\/\S+|[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(?:\.\d+)*)$/;
const PIN = /uses: ([\w.-]+\/[\w./-]+)@([0-9a-f]{40}) # (v\d+(?:\.\d+)*)$/;

/** What each action is pinned to, over a set of uses: action -> digest@tag -> the files that say it. */
function pinsOf(uses: readonly Use[], label: string): Map<string, Map<string, Pin[]>> {
  const actions = new Map<string, Map<string, Pin[]>>();

  for (const { file, line } of uses) {
    const match = PIN.exec(line);

    if (match === null) {
      continue;
    }

    const [, action, digest, tag] = match;
    const versions = actions.get(action) ?? new Map<string, Pin[]>();

    versions.set(`${digest} # ${tag}`, [
      ...(versions.get(`${digest} # ${tag}`) ?? []),
      { file: `${label}${file}`, digest, tag },
    ]);

    actions.set(action, versions);
  }

  return actions;
}

/** The pins of several labelled sets of uses, merged: action -> digest@tag -> the files that say it. */
function mergedPins(sets: readonly (readonly [string, readonly Use[]])[]): Map<string, Map<string, Pin[]>> {
  const merged = new Map<string, Map<string, Pin[]>>();

  for (const [label, uses] of sets) {
    for (const [action, versions] of pinsOf(uses, label)) {
      const known = merged.get(action) ?? new Map<string, Pin[]>();

      for (const [version, pins] of versions) {
        known.set(version, [...(known.get(version) ?? []), ...pins]);
      }

      merged.set(action, known);
    }
  }

  return merged;
}

const TEMPLATES = path.join(REPO_ROOT, 'packages/cli/templates/pipeline/github');
const SOURCES = path.join(REPO_ROOT, 'pipeline/github');

describe('the actions of the GitHub workflows', () => {
  let root = '';

  beforeAll(() => {
    root = initProject(
      '--ci',
      'github',
      '--ci-extras',
      'codeql,dependency-review,claude-review,claude-triage,intent-to-spec',
    );
  });

  it('are pinned by the digest of a commit with the tag in a comment, in every template and in the source of the pipeline', () => {
    const uses = [...usesUnder(TEMPLATES), ...usesUnder(SOURCES)];

    expect(uses.length).toBeGreaterThan(30);
    expect(uses.filter(({ line }) => !PINNED.test(line))).toEqual([]);
  });

  it('are pinned by digest in every file init writes, with each opt-in workflow', () => {
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

  it('name one digest, with one tag, for one action, across the templates, the sources and the files init writes', () => {
    const merged = mergedPins([
      ['templates/', usesUnder(TEMPLATES)],
      ['pipeline/', usesUnder(SOURCES)],
      ['init/', usesUnder(path.join(root, '.github'))],
    ]);

    expect(merged.size).toBeGreaterThan(5);

    const split = [...merged]
      .filter(([, versions]) => versions.size !== 1)
      .map(([action, versions]) => ({ action, versions: [...versions.keys()] }));

    expect(split).toEqual([]);
  });

  it('follow this repository: a bump of an action in its own workflows fails here until the templates and the sources follow', () => {
    const own = [
      ...usesUnder(path.join(REPO_ROOT, '.github/workflows')),
      ...usesUnder(path.join(REPO_ROOT, '.github/actions')),
    ];

    const ours = pinsOf(own, '.github/');

    const shipped = mergedPins([
      ['packages/cli/templates/pipeline/github/', usesUnder(TEMPLATES)],
      ['pipeline/github/', usesUnder(SOURCES)],
    ]);

    const shared = [...ours.keys()].filter((action) => shipped.has(action));

    const stale = shared.flatMap((action) => {
      const mine = [...(ours.get(action)?.keys() ?? [])];
      const theirs = [...(shipped.get(action)?.keys() ?? [])];

      return mine.length === 1 && theirs.length === 1 && mine[0] === theirs[0]
        ? []
        : [
            `${action}: this repository has ${mine.join(' | ')}, the templates and sources have ${theirs.join(' | ')}; ` +
              `update ${[...(shipped.get(action)?.values() ?? [])]
                .flat()
                .map(({ file }) => file)
                .join(', ')}`,
          ];
    });

    expect(shared.length).toBeGreaterThan(3);
    expect(stale).toEqual([]);
  });

  it('are kept current by Renovate, which pins what it updates', () => {
    expect(readJson(root, 'renovate.json')).toMatchObject({
      extends: expect.arrayContaining(['helpers:pinGitHubActionDigests']),
    });
  });
});
