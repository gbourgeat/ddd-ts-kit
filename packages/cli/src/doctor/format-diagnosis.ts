import type { DoctorFinding } from './doctor-finding.js';

/** The findings by area, each with what this version writes, then how to take what is missing. */
export function formatDiagnosis(findings: readonly DoctorFinding[], version: string): string {
  if (findings.length === 0) {
    return `The project has what ddd-ts-kit ${version} writes: scripts, packages of the kit and permissions.`;
  }

  return [`Compared with what ddd-ts-kit ${version} writes:`, ...findings.map(lineOf), '', ...fixesOf(findings)].join(
    '\n',
  );
}

function lineOf({ area, name, problem, expected, found }: DoctorFinding): string {
  const yours = found === undefined ? '' : `; yours: ${found}`;

  return `  ${area} ${name}: ${problem} (${version(area)}${expected}${yours})`;
}

function version(area: DoctorFinding['area']): string {
  return area === 'package' ? 'range ' : '';
}

function fixesOf(findings: readonly DoctorFinding[]): string[] {
  const fixes = ['fix: `npx ddd-ts-kit init` adds what is missing and leaves what the project wrote; then install.'];

  if (findings.some((finding) => finding.area === 'package' && finding.problem === 'other version')) {
    fixes.push(
      'fix: upgrade `ddd-ts-kit` and every `@ddd-ts-kit/*` package together, to the ranges above; the steps of each version are in node_modules/ddd-ts-kit/CHANGELOG.md.',
    );
  }

  if (findings.some((finding) => finding.problem === 'written otherwise')) {
    fixes.push(
      "note: a script written otherwise may be yours on purpose; `npx ddd-ts-kit init --force` writes the kit's version over it.",
    );
  }

  return fixes;
}
