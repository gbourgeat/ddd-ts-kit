import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CliError } from '../cli-error';
import { ESLINT_IN_PROJECT, LINT_RUN_VARIABLE } from '../lint/eslint-in-project';
import { type LintAnswer, parseLintAnswer } from '../lint/parse-lint-answer';
import type { LintRun } from '../lint/lint-run';
import { formatVerdict } from '../lint/format-verdict';
import { lintVerdict } from '../lint/lint-verdict';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';

/**
 * `lint` and `ci:lint` of a generated project: the ESLint of the project, failing on an error or a
 * warning, but on a warning of a rule of the kit in transition, which it reports apart.
 */
export const lintCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { format: { type: 'string' }, fix: { type: 'boolean', default: false } });
  const root = args.projectRoot;

  refuseWithoutEslint(root);

  const answer = runEslint(
    { root, patterns: args.positionals, format: args.text('format') ?? 'stylish', fix: args.flag('fix') },
    io,
  );

  if (answer === undefined) {
    return 2;
  }

  const verdict = lintVerdict(answer);

  if (answer.report.trim() !== '') {
    io.out(answer.report.trimEnd());
  }

  for (const line of formatVerdict(verdict)) {
    io.err(line);
  }

  return verdict.errors > 0 || verdict.warnings > 0 ? 1 : 0;
};

function refuseWithoutEslint(root: string): void {
  try {
    createRequire(path.join(root, 'package.json')).resolve('eslint');
  } catch {
    throw new CliError(
      `ESLint is not installed in ${root}.`,
      'Install the dependencies of the project (`npm ci`): `ddd-ts-kit lint` runs the ESLint of the project.',
    );
  }
}

/** What ESLint answered, or undefined once its failure (a config that does not load, a pattern that matches nothing) is printed. */
function runEslint(lint: LintRun, io: Io): LintAnswer | undefined {
  const run = spawnSync(process.execPath, ['--input-type=module', '--eval', ESLINT_IN_PROJECT], {
    cwd: lint.root,
    encoding: 'utf8',
    env: { ...process.env, [LINT_RUN_VARIABLE]: JSON.stringify(lint) },
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (run.stderr.trim() !== '') {
    io.err(run.stderr.trimEnd());
  }

  if (run.status !== 0) {
    return undefined;
  }

  return parseLintAnswer(run.stdout);
}
