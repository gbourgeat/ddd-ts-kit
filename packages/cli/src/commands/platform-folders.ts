import { readConfig } from '../config/index.js';
import { type FolderMove, placements, platformFolders } from '../platform-folders/index.js';
import { MigrationDraft } from '../refusals/migration-draft.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';

const MANUAL = [
  'Run the formatter, then the checks and the tests: an import the command could not read still names the old path.',
];

/** Takes the files of the platform a project generated flat to the folder of the question each answers. */
export const platformFoldersCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    'dry-run': { type: 'boolean', default: false },
    place: { type: 'string', multiple: true },
  });

  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const draft = new MigrationDraft(ws);
  const migration = platformFolders({ ws, config, placed: placements(args.many('place'), ws, config) }, draft);

  const outcome: Outcome = {
    dryRun: args.flag('dry-run'),
    ...migration,
    manual: [...draft.manual, ...(migration.moved.length > 0 ? MANUAL : [])],
  };

  if (!outcome.dryRun) {
    draft.commit();
  }

  print(io, args.json, outcome);

  return 0;
};

interface Outcome {
  readonly dryRun: boolean;
  readonly moved: readonly FolderMove[];
  readonly rewritten: readonly string[];
  readonly manual: readonly string[];
}

function print(io: Io, json: boolean, outcome: Outcome): void {
  if (json) {
    io.out(JSON.stringify(outcome, null, 2));

    return;
  }

  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);

  const lines = [
    ...outcome.moved.map(({ from, to }) => `${verb('move')}${from} -> ${to}`),
    ...outcome.rewritten.map((file) => `${verb('rewrite')}${file}`),
    ...(outcome.manual.length > 0 ? ['', 'Left to you:', ...outcome.manual.map((line) => `  - ${line}`)] : []),
  ];

  io.out(lines.length > 0 ? lines.join('\n') : 'Nothing to do: the files of the platform are in their folders.');
}
