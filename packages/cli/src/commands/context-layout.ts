import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { contextLayout, type ContextLayout } from '../context-layout';
import { contextArgument } from '../generate/context-argument';
import { exitCodeOf, tellUnwritable, Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';
import { ownEntry } from '../config/values/own-entry';

const MANUAL =
  'Run the formatter, then the checks and the tests: an import the command could not read still names the old path.';

/** Moves the files of the contexts that an earlier version wrote elsewhere to their place of today, their imports with them. */
export const contextLayoutCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { 'dry-run': { type: 'boolean', default: false } });
  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const asked = args.positionals.map((name) => contextArgument(config, name).kebab);
  const unknown = asked.filter((context) => ownEntry(config.contexts, context) === undefined);

  if (unknown.length > 0) {
    throw new CliError(
      `Unknown context "${unknown.join('", "')}".`,
      `Use one of: ${Object.keys(config.contexts).join(', ')}.`,
    );
  }

  const layout = contextLayout(ws, config, asked);

  // A role folder the move emptied would still read as one.
  ws.pruneEmptiedFolders();

  const dryRun = args.flag('dry-run');
  const report = ws.commit(dryRun);
  const listed = new Set([...layout.moved.flatMap(({ from, to }) => [from, to]), ...layout.rewritten]);

  print(io, args.json, {
    dryRun,
    ...layout,
    written: [...report.created, ...report.updated].filter((file) => !listed.has(file)),
    manual: [...layout.manual, ...(layout.moved.length > 0 ? [MANUAL] : [])],
  });

  tellUnwritable(io, report);

  return exitCodeOf(report);
};

interface Outcome extends ContextLayout {
  readonly dryRun: boolean;
  /** The files derived from the tree that the move wrote again: knip.json, the import graph rules, the declarations. */
  readonly written: readonly string[];
}

function print(io: Io, json: boolean, outcome: Outcome): void {
  if (json) {
    io.out(JSON.stringify(outcome, null, 2));

    return;
  }

  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);

  const lines = [
    ...outcome.moved.map(({ from, to }) => `${verb('move')}${from} -> ${to}`),
    ...outcome.rewritten
      .filter((file) => !outcome.moved.some(({ to }) => to === file))
      .map((file) => `${verb('rewrite')}${file}`),
    ...outcome.written.map((file) => `${verb('write')}${file}`),
    ...(outcome.manual.length > 0 ? ['', 'Left to you:', ...outcome.manual.map((line) => `  - ${line}`)] : []),
  ];

  io.out(lines.length > 0 ? lines.join('\n') : 'Nothing to do: the files of every context are in their place.');
}
