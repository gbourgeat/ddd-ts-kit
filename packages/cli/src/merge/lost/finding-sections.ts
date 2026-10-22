import type { MergeFinding } from './merge-finding';

/** Past this many findings in a section, the rest is counted: `--json` lists them all. */
const SHOWN = 30;

const ERROR_SECTIONS: ReadonlyArray<readonly [MergeFinding['kind'], string]> = [
  ['lost-line', 'lost lines'],
  ['row-not-done', 'rows no longer done'],
  ['row-lost', 'rows gone'],
  ['test-lost', 'tests lost'],
  ['spec-deleted', 'spec files deleted'],
  ['file-deleted', 'files deleted by the merge'],
  ['migration-lost', 'migrations lost'],
  ['conflict-marker', 'conflict markers'],
];

/** What a check found, by kind: the errors, then the warnings, the accepted and the repaired findings. */
export interface Findings {
  readonly errors: readonly MergeFinding[];
  readonly warnings: readonly MergeFinding[];
  readonly accepted: readonly MergeFinding[];
  readonly repaired?: readonly MergeFinding[];
}

/** The findings of a merge, one section per kind of error then the others, each line `file:line (side)  text`. */
export function findingSections(findings: Findings): string[] {
  return [
    ...ERROR_SECTIONS.flatMap(([kind, title]) =>
      section(
        title,
        findings.errors.filter((finding) => finding.kind === kind),
      ),
    ),
    ...section('warnings (check that the result keeps the intent of both sides)', findings.warnings),
    ...section('accepted (Lost-Accepted)', findings.accepted),
    ...section('repaired since (HEAD has them again)', findings.repaired ?? []),
  ];
}

function section(title: string, findings: readonly MergeFinding[]): string[] {
  if (findings.length === 0) {
    return [];
  }

  const rest = findings.length - SHOWN;

  return [
    `  ${title}:`,
    ...findings.slice(0, SHOWN).map((finding) => `    ${findingLine(finding)}`),
    ...(rest > 0 ? [`    and ${rest} more (--json lists them all)`] : []),
  ];
}

function findingLine({ kind, file, line, side, text }: MergeFinding): string {
  const place = ['spec-deleted', 'file-deleted', 'migration-lost'].includes(kind) ? file : `${file}:${line}`;
  const who = whoOf(kind, side);

  return kind === 'spec-deleted' ? `${place} (${who})` : `${place} (${who})  ${text}`;
}

const WHO: Partial<Record<MergeFinding['kind'], (side: MergeFinding['side']) => string>> = {
  revived: (side) => `brought back, removed by ${side}`,
  rewritten: (side) => `rewritten by the merge, from ${side}`,
  superseded: (side) => `from ${side}, where the other side changed the same lines`,
};

function whoOf(kind: MergeFinding['kind'], side: MergeFinding['side']): string {
  return WHO[kind]?.(side) ?? side;
}
