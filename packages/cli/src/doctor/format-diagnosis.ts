import type { Stack } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The areas of a checkout rather than of the project: two clones of one project may differ in them. */
const OF_THE_CHECKOUT: ReadonlySet<DoctorFinding['area']> = new Set(['node', 'install', 'submodule']);

/**
 * The findings by area, each with what this version writes, then how to take what is missing;
 * then what this checkout lacks to run the project, and how to give it.
 */
export function formatDiagnosis(
  findings: readonly DoctorFinding[],
  version: string,
  manager: Stack['packageManager'],
): string {
  const ofTheProject = findings.filter((finding) => !OF_THE_CHECKOUT.has(finding.area));
  const ofTheCheckout = findings.filter((finding) => OF_THE_CHECKOUT.has(finding.area));

  return [...projectLines(ofTheProject, version, manager), '', ...checkoutLines(ofTheCheckout, version, manager)].join(
    '\n',
  );
}

function projectLines(findings: readonly DoctorFinding[], version: string, manager: Stack['packageManager']): string[] {
  if (findings.length === 0) {
    return [
      `The project has what ddd-ts-kit ${version} writes: scripts, packages of the kit, permissions, git hooks and review policy.`,
    ];
  }

  return [
    `Compared with what ddd-ts-kit ${version} writes:`,
    ...findings.map(lineOf),
    '',
    ...fixesOf(findings),
    ...folderFixesOf(findings),
    ...hookFixesOf(findings).map((fix) => inDialect(fix, manager)),
  ];
}

function checkoutLines(
  findings: readonly DoctorFinding[],
  version: string,
  manager: Stack['packageManager'],
): string[] {
  if (findings.length === 0) {
    return [
      `This checkout runs it: the Node it asks, its dependencies installed since the lockfile last changed, the packages of the kit at ${version}, its submodules initialised.`,
    ];
  }

  return [
    `What this checkout lacks to run the project, with ddd-ts-kit ${version}:`,
    ...findings.map(lineOf),
    '',
    ...checkoutFixesOf(findings).map((fix) => inDialect(fix, manager)),
  ];
}

function lineOf({ area, name, problem, expected, found }: DoctorFinding): string {
  const yours = found === undefined ? '' : `; yours: ${found}`;

  return `  ${area} ${name}: ${problem} (${version(area)}${expected}${yours})`;
}

function version(area: DoctorFinding['area']): string {
  return area === 'package' ? 'range ' : '';
}

function fixesOf(findings: readonly DoctorFinding[]): string[] {
  const ofTheProject = findings.filter((finding) => finding.area !== 'hook' && finding.area !== 'folder');

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

function folderFixesOf(findings: readonly DoctorFinding[]): string[] {
  return findings.some((finding) => finding.area === 'folder')
    ? [
        'fix: `npx ddd-ts-kit platform-folders` moves them to their folders and rewrites every import of them (`--dry-run` shows what it would do); the generators read either layout until then.',
      ]
    : [];
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

  if (hooks.some((finding) => finding.name === 'lefthook.yml secrets')) {
    fixes.push(
      'fix: add the `secrets` job to the pre-commit jobs of lefthook.yml, as `npx ddd-ts-kit init --force` writes it (it runs `gitleaks git --pre-commit --staged` when gitleaks is installed, prints one line otherwise, and the pipeline scans the whole history anyway).',
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

/** Written for npm, said in the dialect of the project by the caller. */
function checkoutFixesOf(findings: readonly DoctorFinding[]): string[] {
  const has = (area: DoctorFinding['area'], problems: readonly DoctorFinding['problem'][]): boolean =>
    findings.some((finding) => finding.area === area && problems.includes(finding.problem));

  const fixes: string[] = [];

  if (has('node', ['unsupported'])) {
    fixes.push(
      'fix: run the project with a Node that engines.node accepts (`nvm use` switches to the one .nvmrc names, when it has one), then `npm ci`: a dependency built for another Node may not load.',
    );
  } else if (has('node', ['other version'])) {
    fixes.push('fix: `nvm use` switches to the Node .nvmrc names.');
  }

  if (has('install', ['missing', 'outdated', 'not installed'])) {
    fixes.push(
      'fix: `npm ci` installs what package-lock.json holds (`npm install` while the project has none), never an install that names a package.',
    );
  }

  if (has('install', ['other version'])) {
    fixes.push(
      "fix: upgrade `ddd-ts-kit` and every `@ddd-ts-kit/*` package together to one version (the steps of each version are in node_modules/ddd-ts-kit/CHANGELOG.md), then `npm ci`; with a CLI other than the project's, a global one, run `npx ddd-ts-kit doctor` instead: it checks with the version the project installed.",
    );
  }

  if (has('submodule', ['not initialised'])) {
    fixes.push(
      'fix: `git submodule update --init --recursive` checks out each submodule at the commit the project records.',
    );
  }

  return fixes;
}
