import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CliError } from '../cli-error';
import { ESLINT_IN_PROJECT, LINT_RUN_VARIABLE } from '../lint/eslint-in-project';
import { lintCacheOf } from '../lint/lint-cache-of';
import { type LintAnswer, parseLintAnswer } from '../lint/parse-lint-answer';
import type { LintRun } from '../lint/lint-run';
import { formatVerdict } from '../lint/format-verdict';
import { lintVerdict, type LintVerdict } from '../lint/lint-verdict';
import { stdoutJson } from '../json/stdout-json';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';

/**
 * `lint` and `ci:lint` of a generated project: the ESLint of the project, with its cache unless
 * `--no-cache` asks for every file again, failing on an error or a warning. `--json` asks ESLint
 * for its JSON report and answers `{ errors, warnings, report }` on one line.
 */
export const lintCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    format: { type: 'string' },
    fix: { type: 'boolean', default: false },
    'no-cache': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;

  refuseWithoutEslint(root);

  const answer = runEslint(
    {
      root,
      patterns: args.positionals,
      format: args.json ? 'json' : (args.text('format') ?? 'stylish'),
      fix: args.flag('fix'),
      cache: args.flag('no-cache') ? undefined : lintCacheOf(root),
    },
    io,
  );

  if (answer === undefined) {
    return 2;
  }

  const verdict = lintVerdict(answer);

  printVerdict({ answer, verdict, json: args.json }, io);

  return verdict.errors > 0 || verdict.warnings > 0 ? 1 : 0;
};

function printVerdict(
  { answer, verdict, json }: { answer: LintAnswer; verdict: LintVerdict; json: boolean },
  io: Io,
): void {
  if (json) {
    io.out(
      stdoutJson({
        errors: verdict.errors,
        warnings: verdict.warnings,
        report: reportOf(answer.report),
      }),
    );

    return;
  }

  if (answer.report.trim() !== '') {
    io.out(answer.report.trimEnd());
  }

  for (const line of formatVerdict(verdict)) {
    io.err(line);
  }
}

/** The report of the JSON formatter of ESLint as a value; the text itself when a formatter of the project answered otherwise. */
function reportOf(report: string): unknown {
  try {
    return JSON.parse(report);
  } catch {
    return report;
  }
}

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

  refuseWhatEslintRefused(run.stdout, lint);

  return parseLintAnswer(run.stdout);
}

/** ESLint stopped on a pattern that matches no file or a formatter it cannot load: said as a refusal with its next step, not as the stack of Node. */
function refuseWhatEslintRefused(output: string, lint: LintRun): void {
  const refusal = refusalOf(output);

  if (refusal === 'no-files') {
    throw new CliError(
      `No file matches ${lint.patterns.join(', ')}.`,
      'Name files or folders of the project (`ddd-ts-kit lint src`), or leave the patterns out to lint the whole project.',
    );
  }

  if (refusal === 'formatter') {
    throw new CliError(
      `ESLint has no formatter named "${lint.format}".`,
      'Use one of its formatters (stylish, json, junit, html, checkstyle, ...), the name of one installed in the project, or the path of a formatter file.',
    );
  }
}

const REFUSAL = /^\{"refusal":"([\w-]+)"\}$/;

function refusalOf(output: string): string | undefined {
  return REFUSAL.exec(output)?.[1];
}
