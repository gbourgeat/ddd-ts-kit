import { CliError } from '../cli-error.js';
import { readConfig, type Config } from '../config/index.js';
import { refreshDocs } from '../generate/refresh-docs.js';
import { declaredModule } from '../model-modules/index.js';
import { type ModuleMoves, moveToModule } from '../move-to-module/index.js';
import { toName } from '../naming/index.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';

/** Takes files of the model and of the use cases of a context into a module of its model, their imports with them. */
export const moveToModuleCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { 'dry-run': { type: 'boolean', default: false } });
  const [contextName = '', moduleName = '', ...paths] = args.positionals;
  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const context = toName(contextName).kebab;
  const module = toName(moduleName).kebab;

  assertDeclared(config, context, module);

  if (paths.length === 0) {
    throw new CliError(
      'move-to-module needs the paths to move.',
      `Usage: ddd-ts-kit move-to-module ${context} ${module} <path>..., each relative to the context: domain/aggregates/<name>.aggregate.ts, application/commands/<use-case>.`,
    );
  }

  const outcome = moveToModule(ws, config, { context, module, paths });

  // A moved use case leaves no empty folder behind, which would still read as a use case.
  ws.pruneEmptiedFolders();

  // The generated declarations follow the files: those of each folder of the module are written, the emptied ones go.
  refreshDocs(ws, 'move');

  const dryRun = args.flag('dry-run');

  ws.commit(dryRun);
  print(io, args.json, { dryRun, ...outcome });

  return 0;
};

function assertDeclared(config: Config, context: string, module: string): void {
  if (config.contexts[context] === undefined) {
    throw new CliError(`Unknown context "${context}".`, `Use one of: ${Object.keys(config.contexts).join(', ')}.`);
  }

  declaredModule(config, context, module);
}

const LEFT = [
  'Run the formatter, then the checks and the tests: an import the command could not read still names the old path.',
  'Commit one cluster of concepts at a time: module/complete lists what is still at the level of the context.',
];

interface Outcome extends ModuleMoves {
  readonly dryRun: boolean;
}

function print(io: Io, json: boolean, outcome: Outcome): void {
  if (json) {
    io.out(JSON.stringify({ ...outcome, manual: outcome.moved.length > 0 ? LEFT : [] }, null, 2));

    return;
  }

  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);

  const lines = [
    ...outcome.moved.map(({ from, to }) => `${verb('move')}${from} -> ${to}`),
    ...outcome.rewritten.map((file) => `${verb('rewrite')}${file}`),
    ...(outcome.moved.length > 0 ? ['', 'Left to you:', ...LEFT.map((line) => `  - ${line}`)] : []),
  ];

  io.out(lines.length > 0 ? lines.join('\n') : 'Nothing to do: these files are in the module already.');
}
