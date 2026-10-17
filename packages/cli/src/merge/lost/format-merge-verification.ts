import { findingSections } from './finding-sections.js';
import type { MergeCheck } from './merge-check.js';
import type { MergeVerification } from './merge-verification.js';

/**
 * The verification of the merges as a short report: each merge with what it lost, then what to
 * do. Nothing at all without a merge to check, so that a hook running it stays silent.
 */
export function formatMergeVerification(verification: MergeVerification): string {
  return verification.merges.flatMap(mergeLines).join('\n');
}

function mergeLines(merge: MergeCheck): string[] {
  return [
    `${titleOf(merge)}: ${verdictOf(merge)}`,
    ...(merge.errors.length + merge.warnings.length === 0 ? [] : [`  ${baseLine(merge)}`]),
    ...findingSections(merge),
    ...nextLines(merge),
  ];
}

function titleOf({ commit, subject, theirs }: MergeCheck): string {
  return commit === undefined
    ? `merge in progress (HEAD <- ${theirs.slice(0, 7)}) "${subject}"`
    : `merge ${commit.slice(0, 7)} "${subject}"`;
}

function verdictOf({ errors, warnings }: MergeCheck): string {
  const counted = [
    ...(errors.length === 0 ? [] : [`${errors.length} error(s)`]),
    ...(warnings.length === 0 ? [] : [`${warnings.length} warning(s)`]),
  ];

  return counted.length === 0 ? 'ok' : counted.join(', ');
}

function baseLine({ base, baseFrom, ours, theirs }: MergeCheck): string {
  const from = { trailer: 'its Merge-Base trailer', option: '--base', 'merge-base': 'git merge-base' }[baseFrom];

  return `base ${base.slice(0, 7)} (${from}), ours ${ours.slice(0, 7)}, theirs ${theirs.slice(0, 7)}`;
}

function nextLines({ commit, errors, ours, theirs }: MergeCheck): string[] {
  if (errors.length === 0) {
    return [];
  }

  const [fromOurs, fromTheirs] = commit === undefined ? ['HEAD', 'MERGE_HEAD'] : [ours.slice(0, 7), theirs.slice(0, 7)];

  const decided =
    commit === undefined
      ? 'add `Lost-Accepted: <file:line>,...` at the end of the merge message'
      : 'record it in the merge commit as a trailer `Lost-Accepted: <file:line>,...`';

  return [
    `next: restore each one from its side (\`git show ${fromOurs}:<file>\` for ours, \`git show ${fromTheirs}:<file>\` for theirs)${commit === undefined ? ' and resolve every conflict marker before the commit' : ', in a commit of its own'}; never take one side of a whole file. A removal decided on purpose: ${decided}.`,
  ];
}
