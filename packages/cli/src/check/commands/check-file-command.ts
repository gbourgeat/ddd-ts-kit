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

export const checkFileCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const [target, ...extra] = args.positionals;

  if (target === undefined || extra.length > 0) {
    throw new CliError('check-file expects exactly one path.', 'Usage: ddd-ts-kit check-file <path> [--json]');
  }

  const absolute = path.resolve(args.workingDirectory, target);
  const root = findRoot(path.dirname(absolute));
  const file = toPosix(path.relative(root, absolute));

  const result = isProjectSource(root, file)
    ? withBaseline(root, runCheck(loadProject(root, { onlyFile: file }), { fileScopeOnly: true }))
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
function isProjectSource(root: string, file: string): boolean {
  const { config } = readConfig(root);

  return isSource(file) && file.startsWith(`${config.sourceRoot}/`) && fs.existsSync(path.join(root, file));
}
