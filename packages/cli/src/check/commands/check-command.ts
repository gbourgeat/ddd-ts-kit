import path from 'node:path';
import { CliError } from '../../cli-error.js';
import { Arguments } from '../../commands/arguments.js';
import { findRoot } from '../../commands/find-root.js';
import { type Command } from '../../commands/command.js';
import { isOneOf } from '../../config/index.js';
import { CLEAN_RULE_IDS } from '../catalogue/clean-rule-ids.js';
import type { CheckResult } from '../engine/check-result.js';
import { formatCheck, type CheckFormat } from '../engine/format-check.js';
import { runCheck } from '../engine/run-check.js';
import { summarize } from '../engine/summarize.js';
import type { Violation } from '../model/violation.js';
import { loadLooseProject } from '../project/load-loose-project.js';
import { loadProject } from '../project/load-project.js';
import { toPosix } from '../project/to-posix.js';
import { changedFiles } from './changed-files.js';
import { knownRules } from './known-rules.js';
import { selfCheck } from './self-check.js';

const FORMATS: readonly CheckFormat[] = ['text', 'json', 'github', 'gitlab'];

export const checkCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    rule: { type: 'string', multiple: true },
    format: { type: 'string' },
    'changed-since': { type: 'string' },
    self: { type: 'boolean', default: false },
    'clean-only': { type: 'boolean', default: false },
  });

  if (args.flag('self')) {
    return selfCheck(args, io);
  }

  const format = formatOf(args);
  const rules = knownRules(args.many('rule'));
  const result = args.flag('clean-only') ? checkCleanliness(args, rules) : checkProject(args, rules);

  io.out(formatCheck(result, format));

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
  const result = runCheck(loadProject(root), { rules });

  const scopes = args.positionals.map((entry) =>
    toPosix(path.relative(root, path.resolve(cwd, entry))).replace(/\/$/, ''),
  );

  const ref = args.text('changed-since');
  const changed = ref === undefined ? undefined : changedFiles(root, ref);

  const reported = result.violations.filter(
    (violation) => isInScope(violation, scopes) && (changed === undefined || changed.has(violation.file)),
  );

  return summarize(reported, result);
}

function isInScope(violation: Violation, scopes: readonly string[]): boolean {
  return (
    scopes.length === 0 ||
    scopes.some((scope) => scope === '' || violation.file === scope || violation.file.startsWith(`${scope}/`))
  );
}
