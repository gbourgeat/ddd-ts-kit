import type { BasePoint } from './base-point.js';
import { findingSections } from './lost/finding-sections.js';
import type { ForYou, MergeReport } from './merge-report.js';
import { NEXT_STEPS } from './next-steps.js';

/** Past this many commits of the trunk on one file, the rest is counted. */
const COMMITS_SHOWN = 3;

/**
 * The report of merge-trunk for a reader: who merges what from which base and why, the conflicts
 * a plain merge would show against those of the branch's own diff, what was settled and how,
 * what is left with what each side did, then the migrations, regenerate, the lost-lines gate,
 * the commit, and what to do next.
 */
export function formatMergeReport(report: MergeReport): string {
  const short = report.trunk.commit.slice(0, 7);

  return [
    `merge-trunk ${report.branch} <- ${report.trunk.ref} (${short})${report.status === 'dry-run' ? ', dry run: nothing changed' : ''}`,
    ...(report.status === 'up-to-date' ? [] : bodyLines(report)),
    `next: ${report.next}`,
  ].join('\n');
}

function bodyLines(report: MergeReport): string[] {
  const { conflicts } = report;

  return [
    ...baseLines(report.base),
    `conflicts: plain git merge ${conflicts.plainMerge}, own diff since base ${conflicts.ownDiff}, automatic ${conflicts.automatic}, for you ${conflicts.forYou}`,
    ...(report.automatic.length === 0
      ? []
      : ['automatic:', ...report.automatic.map(({ file, how }) => `  ${file}  ${how}`)]),
    ...forYouLines(report),
    ...(report.migrations.length === 0 ? [] : ['migrations:', ...report.migrations.map((line) => `  ${line}`)]),
    ...regenerateLines(report),
    ...lostLines(report),
    ...(report.leftOut.length === 0
      ? []
      : ['left out (not paths of the merge, they block its commit):', ...report.leftOut.map((file) => `  ${file}`)]),
    ...(report.stop === undefined ? [] : [`stopped: ${report.stop}`]),
    ...(report.commit === undefined
      ? []
      : [`committed ${report.commit.slice(0, 7)} "Merge ${report.trunk.ref} into ${report.branch}"`]),
  ];
}

function baseLines(base: BasePoint): string[] {
  const short = base.commit.slice(0, 7);

  if (base.evidence === 'landed' && base.landedAs !== undefined) {
    const { from, commit, subject } = base.landedAs;

    return [`base ${short}: ${from} landed as ${commit.slice(0, 7)} "${subject}"`];
  }

  if (base.evidence === 'option') {
    return [`base ${short}: given by --since`];
  }

  if (base.evidence === 'recorded') {
    return [
      `base ${short}: the base recorded for this worker${base.notOnTrunk === undefined ? ', its lines found on the trunk' : ', not proven: lines of it are not on the trunk'}`,
    ];
  }

  return [
    `base ${short}: git merge-base (no commit of this branch found landed on the trunk)`,
    ...(base.unlanded ?? []).map(
      ({ branch, since }) =>
        `  ${branch} shares commits with this branch and was not found on the trunk: if it landed, pass --since ${since.slice(0, 7)}`,
    ),
  ];
}

function forYouLines(report: MergeReport): string[] {
  if (report.forYou.length === 0) {
    return [];
  }

  if (report.status !== 'dry-run' && report.next !== NEXT_STEPS.resolve) {
    return [`settled by you: ${report.forYou.map((entry) => entry.file).join(', ')}`];
  }

  const header =
    report.status === 'dry-run'
      ? 'for you (once the merge starts):'
      : 'for you (a merge is in progress; `merge-trunk --abort` undoes it):';

  return [header, ...report.forYou.flatMap((entry) => entryLines(entry, report.base.commit))];
}

function entryLines(entry: ForYou, base: string): string[] {
  const where = entry.hunks.length === 0 ? entry.why : `hunks at lines ${entry.hunks.join(', ')}`;
  const rows = entry.ours.rows.length === 0 ? '' : `, rows ${entry.ours.rows.map((row) => `#${row}`).join(', ')}`;

  const commits = entry.theirs.commits.slice(0, COMMITS_SHOWN).map((line) => {
    const [hash = '', ...subject] = line.split(' ');

    return `, ${hash} "${subject.join(' ')}"`;
  });

  const more =
    entry.theirs.commits.length > COMMITS_SHOWN ? ` and ${entry.theirs.commits.length - COMMITS_SHOWN} more` : '';

  return [
    `  ${entry.file}  ${where}`,
    `    ours  (${entry.ours.branch}${rows}): ${entry.ours.change}`,
    `    theirs (${entry.theirs.ref} since ${base.slice(0, 7)}${commits.join('')}${more}): ${entry.theirs.change}`,
    `    ${entry.advice}`,
  ];
}

function regenerateLines({ regenerate }: MergeReport): string[] {
  if (regenerate.status === 'pending') {
    return [];
  }

  const output = regenerate.output === undefined ? [] : regenerate.output.split('\n').map((line) => `  ${line}`);

  return regenerate.status === 'skipped'
    ? [`regenerate: skipped, ${regenerate.output ?? ''}`]
    : [`regenerate: ${regenerate.status}`, ...output];
}

function lostLines({ lostLines: found }: MergeReport): string[] {
  if (found === null) {
    return [];
  }

  const counted = found.errors.length === 0 ? 'none lost' : `${found.errors.length} error(s)`;

  return [
    `lost lines: ${counted}${found.warnings.length === 0 ? '' : `, ${found.warnings.length} warning(s)`}`,
    ...findingSections(found),
  ];
}
