import fs from 'node:fs';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { applyResolutions } from './apply-resolutions';
import { conflictedPaths, type MergedFrom } from './conflicted-paths';
import { continueMerge } from './continue-merge';
import { ensureMergeable } from './ensure-mergeable';
import { forYouEntry } from './for-you-entry';
import { gitVersion } from './git-version';
import { landedPoint } from './landed-point';
import { commitOf } from '../commit/commit-of';
import { type MergeContext, mergeContextOf } from './merge-context';
import { mergeMessage } from './merge-message';
import type { MergeReport } from './merge-report';
import { mergeState } from './merge-state';
import { NEXT_STEPS } from './next-steps';
import { plainGitMerge } from './plain-git-merge';
import { type PreviewRequest, previewMerge, type StageEntry } from './preview-merge';
import { resolveConflict } from './resolve-conflict';
import type { Resolution } from './resolution';
import { startMerge } from './start-merge';
import { trunkOf } from './trunk-of';
import { ensureWritable } from './ensure-writable';

/** What the caller asks of `merge-trunk`, before any merge is in progress. */
export interface MergeTrunkRequest {
  readonly root: string;
  readonly trunk?: string;
  readonly since?: string;
  readonly toLand: boolean;
  readonly dryRun: boolean;
  /** What `git version` prints, when a test pretends another git; probed otherwise. */
  readonly gitVersion?: string;
  readonly now?: Date;
}

/** The merge being opened: who merges what, from which base. */
interface Opening {
  readonly context: MergeContext;
  readonly request: MergeTrunkRequest;
  readonly report: MergeReport;
}

/**
 * Brings the trunk into the branch as one merge commit computed from the branch's own diff: from
 * the landed point, the newest commit of the branch the trunk holds. Settles what a kit derives,
 * leaves the rest in a merge in progress for a person, then (or on `--continue`) lands the
 * migrations, regenerates, checks that no line was lost and commits the paths of the merge.
 * Never rebases, never fetches.
 */
export function mergeTrunk(request: MergeTrunkRequest): MergeReport {
  const context = mergeContextOf(request.root);
  const { top } = context.repo;

  ensureMergeable(top, fs.existsSync(mergeState.file(request.root)));

  const trunk = trunkOf(top, request.trunk);
  const head = commitOf(top, 'HEAD');

  if (head === undefined) {
    throw new CliError('The branch has no commit yet.', 'Commit first: a merge joins two commits.');
  }

  const branch = runGit(top, ['branch', '--show-current'])?.trim() || 'HEAD';

  const blank = {
    status: 'up-to-date',
    branch,
    trunk,
    base: { commit: trunk.commit, evidence: 'merge-base' },
  } as const;

  const report: MergeReport = { ...blank, ...EMPTY, next: NEXT_STEPS.upToDate };

  if (runGit(top, ['merge-base', '--is-ancestor', trunk.commit, head]) !== undefined) {
    return report;
  }

  const base = landedPoint({
    root: request.root,
    repo: context.repo,
    head,
    trunk: trunk.commit,
    ...since(request),
    ...worker(context),
  });

  return opened({ context, request, report: { ...report, base } });
}

const EMPTY = {
  conflicts: { plainMerge: 0, ownDiff: 0, automatic: 0, forYou: 0 },
  automatic: [],
  forYou: [],
  migrations: [],
  regenerate: { status: 'pending' },
  lostLines: null,
  leftOut: [],
} as const;

function opened(opening: Opening): MergeReport {
  const { context, request, report } = opening;
  const { top } = context.repo;

  if (report.base.notOnTrunk !== undefined) {
    const lostLines = { errors: report.base.notOnTrunk, warnings: [], accepted: [] };
    const stop = `the base recorded for this worker (${report.base.commit.slice(0, 7)}) is not proven: some of its lines are not on the trunk`;

    return { ...report, status: 'stopped', lostLines, stop, next: NEXT_STEPS.confirmBase };
  }

  if (!request.dryRun) {
    ensureWritable(top, report.trunk.commit);
  }

  const git = gitVersion(top, request.gitVersion);
  const fork = runGit(top, ['merge-base', 'HEAD', report.trunk.commit])?.trim() ?? '';

  if (!git.mergeBase) {
    return withOldGit(opening, { version: git.version, fork });
  }

  const preview = (base?: string): ReturnType<typeof previewMerge> => previewMerge(top, previewOf(report, base));
  const own = preview(report.base.commit);
  const plain = report.base.commit === fork ? own : preview();
  const resolutions = resolved(context, own.conflicts, { tree: own.tree });
  const counted = counts(context, report, { resolutions, plainMerge: plain.conflicts.size });

  if (request.dryRun) {
    return { ...counted, status: 'dry-run', next: NEXT_STEPS.dryRun };
  }

  startMerge(top, { preview: own, trunk: report.trunk.commit, message: mergeMessage(report) });

  return settled(opening, { report: counted, resolutions });
}

function previewOf(report: MergeReport, base: string | undefined): PreviewRequest {
  return { ...(base === undefined ? {} : { base }), ours: 'HEAD', theirs: report.trunk.ref };
}

/** A git without `merge-tree --merge-base` merges only from the base git computes, with `git merge` itself. */
function withOldGit(opening: Opening, { version, fork }: { version: string; fork: string }): MergeReport {
  const { context, request, report } = opening;

  if (report.base.commit !== fork || request.dryRun) {
    throw new CliError(
      `git ${version} cannot compute a merge from ${request.dryRun ? 'a preview' : `the landed point ${report.base.commit.slice(0, 7)}`}: merge-trunk needs git 2.40 for that.`,
      `Upgrade git; or merge from the base git computes, with more conflicts: \`npx ddd-ts-kit merge-trunk --since ${fork.slice(0, 7)}\`.`,
    );
  }

  const conflicts = plainGitMerge(context.repo.top, { trunk: report.trunk.commit, message: mergeMessage(report) });
  const resolutions = resolved(context, conflicts, 'worktree');

  return settled(opening, {
    report: counts(context, report, { resolutions, plainMerge: conflicts.size }),
    resolutions,
  });
}

function resolved(
  context: MergeContext,
  conflicts: ReadonlyMap<string, readonly StageEntry[]>,
  from: MergedFrom,
): Resolution[] {
  return conflictedPaths(context.repo.top, conflicts, from).map((path) => resolveConflict(path, context.repo));
}

function counts(
  context: MergeContext,
  report: MergeReport,
  { resolutions, plainMerge }: { resolutions: readonly Resolution[]; plainMerge: number },
): MergeReport {
  const automatic = resolutions.filter((resolution) => resolution.settled);
  const left = resolutions.filter((resolution) => !resolution.settled);
  const rows = context.worker?.rows ?? [];
  const named = { top: context.repo.top, branch: report.branch, rows, trunk: report.trunk, base: report.base.commit };

  return {
    ...report,
    conflicts: { plainMerge, ownDiff: resolutions.length, automatic: automatic.length, forYou: left.length },
    automatic: automatic.map(({ file, kind, how }) => ({ file, kind, how })),
    forYou: left.map((resolution) => forYouEntry(resolution, named)),
  };
}

/** The merge is in progress: what was settled is written; with nothing left to a person, it goes straight on. */
function settled(
  opening: Opening,
  { report, resolutions }: { report: MergeReport; resolutions: readonly Resolution[] },
): MergeReport {
  const { context, request } = opening;

  applyResolutions(context.repo.top, resolutions);

  const { forYou } = report;
  const install = needsInstall(context, report, resolutions);
  const state = { report, ours: commitOf(context.repo.top, 'HEAD') ?? '', toLand: request.toLand, install, done: [] };

  if (forYou.length > 0) {
    const stop = `${forYou.length} conflicted path${forYou.length === 1 ? '' : 's'} left for you`;
    const stopped: MergeReport = { ...report, status: 'stopped', stop, next: NEXT_STEPS.resolve };

    mergeState.write(context.root, { ...state, report: stopped });

    return stopped;
  }

  // The merge is in progress: a process stopped from here on leaves a state `--continue` goes on from.
  mergeState.write(context.root, state);

  return continueMerge(context, state, { acceptLost: false, now: request.now ?? new Date() });
}

/** The lockfile took the trunk's side: it is installed again when the branch changed package.json since the base. */
function needsInstall(context: MergeContext, report: MergeReport, resolutions: readonly Resolution[]): boolean {
  if (!resolutions.some((resolution) => resolution.kind === 'lockfile')) {
    return false;
  }

  return runGit(context.root, ['diff', '--quiet', report.base.commit, 'HEAD', '--', 'package.json']) === undefined;
}

function since({ since: commit }: MergeTrunkRequest): { since?: string } {
  return commit === undefined ? {} : { since: commit };
}

function worker({ worker: scope }: MergeContext): { worker?: NonNullable<MergeContext['worker']> } {
  return scope === undefined ? {} : { worker: scope };
}
