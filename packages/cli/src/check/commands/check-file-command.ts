import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';
import { Arguments } from '../../commands/arguments';
import { findRoot } from '../../commands/find-root';
import { type Command } from '../../commands/command';
import { readConfig } from '../../config';
import { applyBaseline } from '../baseline/apply-baseline';
import { readBaseline } from '../baseline/read-baseline';
import type { CheckResult } from '../engine/check-result';
import { formatCheck } from '../engine/format-check';
import { runCheck } from '../engine/run-check';
import { summarize } from '../engine/summarize';
import { isSource } from '../project/is-source';
import { loadProject } from '../project/load-project';
import { toPosix } from '../project/to-posix';
import { knownRules } from './known-rules';

/**
 * The per-file rules on one source. `--content-from <file>` judges that text in place of what is on
 * disk, which may not exist yet: what a session is about to write, read by the guard of the plugin
 * before the write. `--rule` narrows the rules.
 */
export const checkFileCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    'content-from': { type: 'string' },
    rule: { type: 'string', multiple: true },
  });

  const [target, ...extra] = args.positionals;

  if (target === undefined || extra.length > 0) {
    throw new CliError(
      'check-file expects exactly one path.',
      'Usage: ddd-ts-kit check-file <path> [--content-from <file>] [--rule <id>]... [--json]',
    );
  }

  const absolute = path.resolve(args.workingDirectory, target);
  const root = findRoot(path.dirname(absolute));
  const file = toPosix(path.relative(root, absolute));
  const contentFrom = args.text('content-from');

  const text =
    contentFrom === undefined ? undefined : fs.readFileSync(path.resolve(args.workingDirectory, contentFrom), 'utf8');

  const rules = knownRules(args.many('rule'));

  const result = isProjectSource(root, file, text !== undefined)
    ? withBaseline(root, runCheck(loadProject(root, { onlyFile: file, text }), { fileScopeOnly: true, rules }))
    : summarize([]);

  io.out(formatCheck(result, args.json ? 'json' : 'text'));

  return result.errorCount > 0 ? 1 : 0;
};

/** The errors the baseline records stay quiet; its counts are judged by `check`, which runs every rule. */
function withBaseline(root: string, result: CheckResult): CheckResult {
  const baseline = readBaseline(root);

  return baseline === undefined
    ? result
    : summarize(applyBaseline(result.violations, baseline, { stale: false }), result);
}

/** Files outside the source root, or that are not sources, have no per-file rule: a hook stays silent on them. */
function isProjectSource(root: string, file: string, given: boolean): boolean {
  const { config } = readConfig(root);

  return isSource(file) && file.startsWith(`${config.sourceRoot}/`) && (given || fs.existsSync(path.join(root, file)));
}
