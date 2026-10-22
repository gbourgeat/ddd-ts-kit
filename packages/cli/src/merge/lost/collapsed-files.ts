import type { MergeFinding } from './merge-finding';
import type { MergeSides } from './merge-sides';
import { SPEC_FILE } from './spec-file';

const LINE_KINDS: ReadonlySet<MergeFinding['kind']> = new Set(['lost-line', 'superseded', 'rewritten']);

/**
 * The line findings of a file the result no longer has, gathered into one: a file deleted in the
 * merge commit itself, when neither side deleted it, is one decision to confirm, not a list of
 * its lines. `file-deleted` when it held lost lines; a spec file is left to `spec-deleted`; a file
 * a side deleted keeps its `superseded` warnings, one per file too.
 */
export function collapsedFiles(findings: readonly MergeFinding[], { result }: MergeSides): MergeFinding[] {
  const gone = (finding: MergeFinding): boolean => LINE_KINDS.has(finding.kind) && !result.has(finding.file);
  const groups = new Map<string, MergeFinding[]>();

  for (const finding of findings.filter(gone)) {
    groups.set(`${finding.kind}|${finding.file}`, [...(groups.get(`${finding.kind}|${finding.file}`) ?? []), finding]);
  }

  return [...findings.filter((finding) => !gone(finding)), ...[...groups.values()].flatMap(gathered)];
}

function gathered(group: readonly MergeFinding[]): MergeFinding[] {
  const [first] = group;

  if (first === undefined || SPEC_FILE.test(first.file)) {
    return [];
  }

  const kind = first.kind === 'lost-line' ? 'file-deleted' : first.kind;
  const text = `${group.length} line(s) of it in no file of the result`;

  return [{ kind, file: first.file, line: 1, side: first.side, text }];
}
