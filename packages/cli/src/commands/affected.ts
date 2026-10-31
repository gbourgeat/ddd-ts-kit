import { trunkExample } from '../commit/trunk-example';
import { changedPaths } from '../affected/changed-paths';
import { everything } from '../affected/everything';
import { formatSelection } from '../affected/format-selection';
import { runAffected } from '../affected/run-affected';
import { selectAffected } from '../affected/select-affected';
import type { Selection } from '../affected/selection';
import { CliError } from '../cli-error';
import { readConfig, type Config } from '../config';
import { Arguments } from './arguments';
import type { Command } from './command';

const FORMATS = ['text', 'json', 'github', 'env'];

/**
 * `affected`: what a pull request has to run, read from the context map and the paths that
 * differ between two commits. Without `--base` everything is selected, which is what the
 * default branch runs; so is it whenever git cannot give the difference, a ref that names no
 * commit included (the pre-push hook of a clone without origin/HEAD runs everything). A value
 * that starts with a dash is refused: no ref does, and git would read it as one of its options.
 * `--run <script>` runs
 * that script of the project on the selection, as the pipeline does: the pre-push hook of a
 * project tests the contexts its branch reaches, not every context.
 */
export const affectedCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    base: { type: 'string' },
    head: { type: 'string' },
    format: { type: 'string' },
    run: { type: 'string' },
  });

  const format = args.json ? 'json' : (args.text('format') ?? 'text');

  if (!FORMATS.includes(format)) {
    throw new CliError(`Unknown value "${format}" for --format.`, `Use one of: ${FORMATS.join(', ')}.`);
  }

  const root = args.projectRoot;
  const { config } = readConfig(root);
  const selection = selectionFor(root, config, args);
  const script = args.text('run');

  if (script !== undefined) {
    return runAffected({ root, manager: config.stack.packageManager, selection, script }, io);
  }

  io.out(formatSelection(selection, format));

  return 0;
};

function selectionFor(root: string, config: Config, args: Arguments): Selection {
  const base = args.text('base');

  if (base === undefined || base === '') {
    return everything(config, 'no base to compare with');
  }

  const head = args.text('head') ?? 'HEAD';

  refuseOption(root, 'base', base);
  refuseOption(root, 'head', head);

  const changed = changedPaths(root, base, head);

  return changed === undefined
    ? everything(config, `git cannot tell what changed since ${base}`)
    : selectAffected(config, changed);
}

/** A value git would read as one of its options: `--base=--output=<file>` once wrote the difference into that file. */
function refuseOption(root: string, option: string, ref: string): void {
  if (ref.startsWith('-')) {
    throw new CliError(
      `${ref} is not a commit of this repository: no ref starts with a dash.`,
      `Name a branch, a tag or a commit: \`--${option} ${trunkExample(root)}\`.`,
    );
  }
}
