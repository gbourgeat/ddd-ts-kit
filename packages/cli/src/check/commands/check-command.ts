import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';
import { Arguments } from '../../commands/arguments';
import { findRoot } from '../../commands/find-root';
import { type Command } from '../../commands/command';
import type { Io } from '../../commands/io';
import { isOneOf } from '../../config';
import { applyBaseline } from '../baseline/apply-baseline';
import { BASELINE_FILE, readBaseline } from '../baseline/read-baseline';
import { writeBaseline } from '../baseline/write-baseline';
import { baselineFollowingMoves } from '../baseline/baseline-following-moves';
import { prunedBaseline } from '../baseline/pruned-baseline';
import { renamedFiles } from '../baseline/renamed-files';
import { recordedBaseline } from '../baseline/recorded-baseline';
import { CLEAN_RULE_IDS } from '../catalogue/clean-rule-ids';
import type { CheckResult } from '../engine/check-result';
import { formatCheck, type CheckFormat } from '../engine/format-check';
import { runCheck } from '../engine/run-check';
import { summarize } from '../engine/summarize';
import { explanationsOf } from '../explain/explanations-of';
import type { Violation } from '../model/violation';
import { loadLooseProject } from '../project/load-loose-project';
import { loadProject } from '../project/load-project';
import { toPosix } from '../project/to-posix';
import { knownCommit } from '../../commit/known-commit';
import { changedFiles } from './changed-files';
import { isReportedSince } from './is-reported-since';
import { knownRules } from './known-rules';
import { selfCheck } from './self-check';

const FORMATS: readonly CheckFormat[] = ['text', 'json', 'github', 'gitlab'];

const CHANGED_SINCE_FIX =
  'Run it in a git repository and name a branch, a tag or a commit git knows (`git fetch origin` first in CI, with enough history): `--changed-since origin/main`.';

export const checkCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    rule: { type: 'string', multiple: true },
    format: { type: 'string' },
    'changed-since': { type: 'string' },
    self: { type: 'boolean', default: false },
    'clean-only': { type: 'boolean', default: false },
    explain: { type: 'boolean', default: false },
    baseline: { type: 'string' },
  });

  if (args.flag('self')) {
    return selfCheck(args, io);
  }

  const baseline = args.text('baseline');

  if (baseline !== undefined) {
    return rewriteBaseline(args, io, baseline);
  }

  const format = formatOf(args);
  const rules = knownRules(args.many('rule'));
  const result = args.flag('clean-only') ? checkCleanliness(args, rules) : checkProject(args, rules);

  const explanations = args.flag('explain') ? explanationsOf(result.violations) : undefined;

  io.out(formatCheck(result, format, explanations));

  return result.errorCount > 0 ? 1 : 0;
};

function formatOf(args: Arguments): CheckFormat {
  const format = args.json ? 'json' : (args.text('format') ?? 'text');

  if (isOneOf(FORMATS, format)) {
    return format;
  }

  throw new CliError(`Unknown format "${format}".`, `Use one of: ${FORMATS.join(', ')}.`);
}

/** The rules that judge a file on its own, on any directories: no project, no config. */
function checkCleanliness(args: Arguments, rules: readonly string[]): CheckResult {
  const directories = args.positionals.length > 0 ? args.positionals : ['.'];

  refuseMissingPaths(args);

  const selected = rules.length > 0 ? rules.filter((id) => CLEAN_RULE_IDS.includes(id)) : CLEAN_RULE_IDS;

  const project = loadLooseProject(
    args.workingDirectory,
    directories.map((entry) => toPosix(path.normalize(entry))),
  );

  return runCheck(project, { rules: selected });
}

function checkProject(args: Arguments, rules: readonly string[]): CheckResult {
  const cwd = args.workingDirectory;
  const root = findRoot(cwd);

  refuseMissingPaths(args);

  const result = withBaseline(root, runCheck(loadProject(root), { rules }), rules);

  const scopes = args.positionals.map((entry) =>
    toPosix(path.relative(root, path.resolve(cwd, entry))).replace(/\/$/, ''),
  );

  const ref = args.text('changed-since');
  const changed = ref === undefined ? undefined : changedFiles(root, knownCommit(root, ref, CHANGED_SINCE_FIX));

  const reported = result.violations.filter(
    (violation) => isInScope(violation, scopes) && isReportedSince(violation, changed),
  );

  return summarize(reported, result);
}

/** A path that exists nowhere is a slip of the caller; an empty report on it would read as clean. */
function refuseMissingPaths(args: Arguments): void {
  const missing = args.positionals.filter((entry) => !fs.existsSync(path.resolve(args.workingDirectory, entry)));

  if (missing.length > 0) {
    throw new CliError(
      `No such path: ${missing.join(', ')}.`,
      'Name a file or a folder of the project (`ddd-ts-kit check src`), or leave the path out to check the whole project.',
    );
  }
}

/** The errors the baseline of the project records stay quiet; a count it no longer reaches is judged when every rule ran. */
function withBaseline(root: string, result: CheckResult, rules: readonly string[]): CheckResult {
  const baseline = readBaseline(root);

  return baseline === undefined
    ? result
    : summarize(applyBaseline(result.violations, baseline, { stale: rules.length === 0 }), result);
}

/**
 * `--baseline write` records the errors of every rule on every file; `--baseline prune` lowers the
 * recorded counts to what the project still has, and never raises one.
 */
function rewriteBaseline(args: Arguments, io: Io, mode: string): number {
  if (mode !== 'write' && mode !== 'prune') {
    throw new CliError(`Unknown --baseline "${mode}".`, 'Use --baseline write or --baseline prune.');
  }

  if (args.many('rule').length > 0 || args.positionals.length > 0 || args.text('changed-since') !== undefined) {
    throw new CliError(
      `--baseline ${mode} judges every rule on every file.`,
      'Run it without --rule, a path or --changed-since.',
    );
  }

  const root = findRoot(args.workingDirectory);
  const { violations } = runCheck(loadProject(root));
  const recorded = readBaseline(root);

  const baseline =
    mode === 'write' || recorded === undefined
      ? recordedBaseline(violations)
      : prunedBaseline(baselineFollowingMoves(recorded, renamedFiles(root)), violations);

  writeBaseline(root, baseline);
  io.out(baselineSummary(baseline));

  return 0;
}

function baselineSummary(baseline: ReturnType<typeof recordedBaseline>): string {
  const entries = Object.values(baseline).flatMap((rules) => Object.values(rules));
  const errors = entries.reduce((total, { count }) => total + count, 0);

  return `${BASELINE_FILE}: ${errors} error${errors === 1 ? '' : 's'} recorded in ${Object.keys(baseline).length} file${Object.keys(baseline).length === 1 ? '' : 's'}. Commit it; \`ddd-ts-kit check\` reports only what it does not hold, and fails when a count it records is no longer reached.`;
}

function isInScope(violation: Violation, scopes: readonly string[]): boolean {
  return (
    scopes.length === 0 ||
    scopes.some((scope) => scope === '' || violation.file === scope || violation.file.startsWith(`${scope}/`))
  );
}
