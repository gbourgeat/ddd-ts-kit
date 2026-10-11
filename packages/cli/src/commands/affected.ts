import { changedPaths } from '../affected/changed-paths.js';
import { everything } from '../affected/everything.js';
import { formatSelection } from '../affected/format-selection.js';
import { selectAffected } from '../affected/select-affected.js';
import type { Selection } from '../affected/selection.js';
import { CliError } from '../cli-error.js';
import { readConfig, type Config } from '../config/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

const FORMATS = ['text', 'json', 'github', 'env'];

/**
 * `affected`: what a pull request has to run, read from the context map and the paths that
 * differ between two commits. Without `--base` everything is selected, which is what the
 * default branch runs; so is it whenever git cannot give the difference.
 */
export const affectedCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    base: { type: 'string' },
    head: { type: 'string' },
    format: { type: 'string' },
  });

  const format = args.json ? 'json' : (args.text('format') ?? 'text');

  if (!FORMATS.includes(format)) {
    throw new CliError(`Unknown value "${format}" for --format.`, `Use one of: ${FORMATS.join(', ')}.`);
  }

  const root = args.projectRoot;

  io.out(formatSelection(selectionFor(root, readConfig(root).config, args), format));

  return 0;
};

function selectionFor(root: string, config: Config, args: Arguments): Selection {
  const base = args.text('base');

  if (base === undefined || base === '') {
    return everything(config, 'no base to compare with');
  }

  const changed = changedPaths(root, base, args.text('head') ?? 'HEAD');

  return changed === undefined
    ? everything(config, `git cannot tell what changed since ${base}`)
    : selectAffected(config, changed);
}
