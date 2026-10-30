import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../check/support/is-record';
import { findProjectFormatter } from '../migration/find-project-formatter';
import { inProjectDialect } from '../package-manager/in-project-dialect';

/** What a tool answered: its exit code and everything it printed. */
interface ToolRun {
  readonly status: number;
  readonly output: string;
}

/** Runs a program with node's arguments in a directory; the seam that keeps the checks testable without real tools. */
export type RunTool = (program: string, args: readonly string[], cwd: string) => ToolRun;

/** What the project's own tools found on the files about to be locked, and what was left unchecked and why. */
export interface LockedFilesCheck {
  readonly findings: readonly string[];
  readonly unchecked: readonly string[];
}

/** What runs the programs, and the command line of the kit that `lint` is run through; both replaced by a test. */
export interface Tools {
  readonly run?: RunTool;
  readonly cli?: string | undefined;
}

/** Enough of a failing tool to read the cause. */
const TAIL_LINES = 40;

/**
 * Runs the formatter and the linter of the project, as its `format` and `lint` scripts name them, on
 * the files a lock is about to make untouchable, and only on those. A tool the project has no script
 * for, or has not installed, checks nothing and is listed as unchecked: the lock goes as it did.
 */
export function checkLockedFiles(root: string, files: readonly string[], tools: Tools = {}): LockedFilesCheck {
  if (files.length === 0) {
    return { findings: [], unchecked: [] };
  }

  const { run = runWithNode, cli = process.argv[1] } = tools;
  const checks = [formatCheck(root, files, run), lintCheck({ root, files, run, cli })];

  return {
    findings: checks.flatMap((check) => (check.finding === undefined ? [] : [check.finding])),
    unchecked: checks.flatMap((check) => (check.unchecked === undefined ? [] : [check.unchecked])),
  };
}

interface Check {
  readonly finding?: string;
  readonly unchecked?: string;
}

function formatCheck(root: string, files: readonly string[], run: RunTool): Check {
  const formatter = findProjectFormatter(root);

  if (typeof formatter === 'string') {
    return { unchecked: `format: ${formatter}` };
  }

  const checking = formatter.args.map((arg) => (arg === '--write' && formatter.name === 'Prettier' ? '--check' : arg));
  const args = formatter.name === 'Biome' ? checking.filter((arg) => arg !== '--write') : checking;
  const result = run(process.execPath, [formatter.bin, ...args, ...files], root);

  return result.status === 0
    ? {}
    : {
        finding: inProjectDialect(
          `${formatter.name} wants these files formatted (\`npm run format\`):\n${tail(result.output)}`,
          root,
        ),
      };
}

interface LintRequest {
  readonly root: string;
  readonly files: readonly string[];
  readonly run: RunTool;
  readonly cli: string | undefined;
}

function lintCheck({ root, files, run, cli }: LintRequest): Check {
  const script = scriptOf(root, 'lint');

  if (script === undefined) {
    return { unchecked: 'lint: package.json has no `lint` script' };
  }

  const program = lintProgram(root, script, cli);

  if (typeof program === 'string') {
    return { unchecked: `lint: ${program}` };
  }

  const result = run(process.execPath, [...program, ...files], root);

  return result.status === 0
    ? {}
    : { finding: inProjectDialect(`The linter reports these files (\`npm run lint\`):\n${tail(result.output)}`, root) };
}

/** The node arguments that lint the given files as the `lint` script does, or why they cannot be found. */
function lintProgram(root: string, script: string, cli: string | undefined): string[] | string {
  if (!resolves(root, 'eslint')) {
    return inProjectDialect('ESLint is not installed (run `npm install`)', root);
  }

  if (/\bddd-ts-kit\s+lint\b/.test(script)) {
    return cli === undefined ? 'the ddd-ts-kit command line is not known' : [cli, 'lint', '--no-cache'];
  }

  const bin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');

  return /\beslint\b/.test(script) && fs.existsSync(bin)
    ? [bin, '--max-warnings', '0']
    : 'the `lint` script does not run ESLint';
}

function resolves(root: string, name: string): boolean {
  return fs.existsSync(path.join(root, 'node_modules', name, 'package.json'));
}

function scriptOf(root: string, name: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const scripts = isRecord(manifest) ? manifest['scripts'] : undefined;
    const script = isRecord(scripts) ? scripts[name] : undefined;

    return typeof script === 'string' ? script : undefined;
  } catch {
    return undefined;
  }
}

function tail(output: string): string {
  return output.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');
}

function runWithNode(program: string, args: readonly string[], cwd: string): ToolRun {
  const run = spawnSync(program, [...args], { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });

  return { status: run.status ?? 1, output: `${run.stdout}${run.stderr}${run.error?.message ?? ''}` };
}
