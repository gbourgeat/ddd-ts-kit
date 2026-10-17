import type { Stack } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The findings by area, each with what this version writes, then how to take what is missing. */
export function formatDiagnosis(
  findings: readonly DoctorFinding[],
  version: string,
  manager: Stack['packageManager'],
): string {
  if (findings.length === 0) {
    return `The project has what ddd-ts-kit ${version} writes: scripts, packages of the kit, permissions and git hooks.`;
  }

  return [
    `Compared with what ddd-ts-kit ${version} writes:`,
    ...findings.map(lineOf),
    '',
    ...fixesOf(findings),
    ...hookFixesOf(findings).map((fix) => inDialect(fix, manager)),
  ].join('\n');
}

function lineOf({ area, name, problem, expected, found }: DoctorFinding): string {
  const yours = found === undefined ? '' : `; yours: ${found}`;

  return `  ${area} ${name}: ${problem} (${version(area)}${expected}${yours})`;
}

function version(area: DoctorFinding['area']): string {
  return area === 'package' ? 'range ' : '';
}

function fixesOf(findings: readonly DoctorFinding[]): string[] {
  const ofTheProject = findings.filter((finding) => finding.area !== 'hook');

  const fixes =
    ofTheProject.length === 0
      ? []
      : ['fix: `npx ddd-ts-kit init` adds what is missing and leaves what the project wrote; then install.'];

  if (ofTheProject.some((finding) => finding.area === 'package' && finding.problem === 'other version')) {
    fixes.push(
      'fix: upgrade `ddd-ts-kit` and every `@ddd-ts-kit/*` package together, to the ranges above; the steps of each version are in node_modules/ddd-ts-kit/CHANGELOG.md.',
    );
  }

  if (ofTheProject.some((finding) => finding.problem === 'written otherwise')) {
    fixes.push(
      "note: a script written otherwise may be yours on purpose; `npx ddd-ts-kit init --force` writes the kit's version over it.",
    );
  }

  return fixes;
}

/** Written for npm, said in the dialect of the project by the caller. */
function hookFixesOf(findings: readonly DoctorFinding[]): string[] {
  const hooks = findings.filter((finding) => finding.area === 'hook');
  const fixes: string[] = [];

  if (hooks.some((finding) => finding.name === 'lefthook.yml lefthook')) {
    fixes.push(
      "fix: add the line `lefthook: node_modules/.bin/lefthook` at the top of lefthook.yml (or `npx ddd-ts-kit init --force` writes the kit's lefthook.yml over yours), then `npm run hooks:install`: each checkout then runs its own lefthook, and one without its dependencies fails the commit instead of skipping the checks.",
    );
  }

  if (hooks.some((finding) => finding.name === 'lefthook.yml')) {
    fixes.push('fix: `npx ddd-ts-kit init` writes lefthook.yml; then `npm run hooks:install`.');
  }

  if (hooks.some((finding) => finding.name === 'pre-commit')) {
    fixes.push(
      'fix: `npm run hooks:install` installs the hooks of lefthook.yml in this clone, once: every worktree of the repository shares them.',
    );
  }

  return fixes;
}
