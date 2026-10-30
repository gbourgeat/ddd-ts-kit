import { DERIVED_FILES } from '../derived/derived-files';
import { KIT_FOLDER } from '../workspace/kit-folder';

/** The lockfiles of the package managers a project of the kit can use. */
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];

/**
 * What the merge leaves out on top of the files `npm run regenerate` writes again: the slices and
 * plan files the conductor edits at the merge, the state of the kit in a worktree, the migrations,
 * renamed from working ones, and the lockfiles.
 */
const MERGE_ONLY = [
  'docs/architecture/slices.md',
  'docs/architecture/plan.md',
  `${KIT_FOLDER}/**`,
  '**/migrations/**',
  ...LOCKFILES.map((file) => `**/${file}`),
];

/**
 * The pathspecs a patch is compared without, to find the commit of the trunk that took a branch
 * in: what a tool writes again on the trunk (the kinds of `DERIVED_FILES` that `regenerate`
 * rewrites, the declarations of a context among them, at its root and in its role folders), then
 * what the merge adds on top. Relative to the project, for a git run from its root.
 */
export function mergeExclusions(contextsDir: string): string[] {
  const left = [
    ...DERIVED_FILES.filter((kind) => kind.regenerated).flatMap((kind) => kind.pathspecs({ contextsDir })),
    ...MERGE_ONLY,
  ];

  return ['.', ...left.map((spec) => `:(exclude,glob)${spec}`)];
}
