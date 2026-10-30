import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/parse-config';
import { DERIVED_FILES } from '../src/derived/derived-files';
import type { DerivedTree } from '../src/derived/derived-tree';
import { isDerived } from '../src/derived/is-derived';
import { isDerivedInMerge } from '../src/merge/is-derived-in-merge';
import { mergeExclusions } from '../src/merge/merge-exclusions';
import { generatedFiles } from '../src/review';
import { tempDir, write } from './helpers';
import { git } from './support/git';

const TREE: DerivedTree = {
  contextsDir: 'src/contexts',
  modules: { billing: ['invoicing'] },
  platformDir: 'src/platform',
};

/** One path of each kind the kit writes, and paths a person writes beside them. */
const PATHS = [
  'src/contexts/billing/billing.declarations.ts',
  'src/contexts/billing/application/application.declarations.ts',
  'src/contexts/billing/invoicing/application/application.declarations.ts',
  'src/contexts/billing/billing.dependencies.ts',
  'src/contexts/billing/CONTEXT.md',
  'openapi/openapi.yaml',
  'clients/billing/src/client.ts',
  'docs/integration/asyncapi.yaml',
  'docs/integration/event-catalog.md',
  'docs/behaviour/billing.md',
  'docs/context-map.md',
  'src/platform/http/openapi-documents.ts',
  'src/platform/database/schema.ts',
  '.dependency-cruiser.cjs',
  'docs/integration/README.md',
  'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
  'src/contexts/billing/billing.permissions.ts',
  'docs/architecture/slices.md',
];

const MERGE_REPOSITORY = { top: '/repository', prefix: '', contextsDir: TREE.contextsDir, modules: TREE.modules };

/** The paths of the sample git lists once the exclusions of the merge are applied. */
function leftByTheMerge(): string[] {
  const root = tempDir('derived');

  for (const file of PATHS) {
    write(root, file, 'written\n');
  }

  git(root, 'init', '--quiet');
  git(root, 'add', '--all');

  return git(root, 'ls-files', '--', ...mergeExclusions(TREE.contextsDir))
    .split('\n')
    .filter((file) => file !== '');
}

describe('the files the kit derives, one list for the merge, the staging of a slice, REVIEW.md and digest', () => {
  it('lists apart, for a review, every file the merge regenerates', () => {
    const reviewed = PATHS.filter((file) => DERIVED_FILES.some((kind) => kind.covers(file, TREE)));

    expect(PATHS.filter((file) => isDerived(file, TREE)).every((file) => reviewed.includes(file))).toBe(true);

    expect(
      PATHS.filter((file) => isDerivedInMerge(file, MERGE_REPOSITORY)).every((file) => reviewed.includes(file)),
    ).toBe(true);
  });

  it('regenerates in a merge, and leaves out of the patches it compares, every file of a kind regenerate rewrites', () => {
    const left = leftByTheMerge();

    const regenerated = PATHS.filter((file) =>
      DERIVED_FILES.some(
        (kind) =>
          kind.regenerated && kind.pathspecs({ contextsDir: TREE.contextsDir }).length > 0 && kind.covers(file, TREE),
      ),
    );

    expect(regenerated.filter((file) => !isDerived(file, MERGE_REPOSITORY))).toEqual([]);
    expect(regenerated.filter((file) => left.includes(file))).toEqual([]);
    expect(left.filter((file) => isDerived(file, MERGE_REPOSITORY))).toEqual([]);
  });

  it('keeps the README of the integration documents, the schema index and the files of a person out of what is regenerated', () => {
    const kept = [
      'docs/integration/README.md',
      'src/platform/database/schema.ts',
      'src/contexts/billing/billing.permissions.ts',
    ];

    expect(kept.filter((file) => isDerived(file, TREE))).toEqual([]);
    expect(leftByTheMerge()).toEqual(expect.arrayContaining(kept));
  });

  it('names in REVIEW.md each kind of the list, in its order', () => {
    const config = parseConfig({ contexts: {} });

    expect(generatedFiles(config).map((kind) => kind.label)).toEqual(
      DERIVED_FILES.map((kind) => kind.label({ ...TREE, platformDir: config.platformDir })),
    );
  });

  it('gives every kind its pathspecs, the files of the platform among them once the platform is known', () => {
    const known = DERIVED_FILES.flatMap((kind) => kind.pathspecs(TREE));
    const unknown = DERIVED_FILES.flatMap((kind) => kind.pathspecs({ contextsDir: TREE.contextsDir }));

    expect(known).toEqual(expect.arrayContaining(['docs/behaviour/**', 'src/platform/database/schema.ts']));
    expect(unknown).not.toContain('src/platform/database/schema.ts');
    expect(unknown).toContain('docs/behaviour/**');
  });
});
