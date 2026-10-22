import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { finishMigration } from '../controllers/finish-migration';
import { migrateContext } from '../controllers/migrate-context';
import type { Migration } from '../controllers/migration';
import { MigrationDraft } from '../refusals/migration-draft';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * Moves the function routes of a project to controller classes, context by context: each
 * `<name>.route.ts` becomes `<resource>/<name>/<name>.controller.ts` behind the group of its
 * resource, its schema files follow it, its spec too. A context is turned whole or not at all.
 */
export const controllersCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { 'dry-run': { type: 'boolean', default: false } });
  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const [asked] = args.positionals;

  if (asked !== undefined && config.contexts[asked] === undefined) {
    throw new CliError(`Unknown context "${asked}".`, `Use one of: ${Object.keys(config.contexts).join(', ')}.`);
  }

  const migration: Migration = {
    ws,
    config,
    draft: new MigrationDraft(ws),
    renamed: new Map(),
    moved: [],
    blockers: [],
  };

  const contexts = asked === undefined ? Object.keys(config.contexts) : [asked];
  const turned = contexts.filter((context) => migrateContext(migration, context));

  if (turned.length > 0) {
    finishMigration(migration, turned);
  }

  const outcome = outcomeOf(migration, args.flag('dry-run'));

  if (!outcome.dryRun) {
    migration.draft.commit();
  }

  io.out(args.json ? JSON.stringify({ contexts: turned, ...outcome }, null, 2) : report(outcome));

  return outcome.blockers.length > 0 ? 1 : 0;
};

function outcomeOf({ draft, moved, blockers }: Migration, dryRun: boolean): Outcome {
  return { dryRun, moved, written: draft.written, removed: draft.removed, blockers, manual: draft.manual };
}

interface Outcome {
  readonly dryRun: boolean;
  readonly moved: readonly string[];
  readonly written: readonly string[];
  readonly removed: readonly string[];
  readonly blockers: readonly string[];
  readonly manual: readonly string[];
}

function report(outcome: Outcome): string {
  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);

  const lines = [
    ...outcome.moved.map((move) => `${verb('move')}${move}`),
    ...outcome.written.map((file) => `${verb('write')}${file}`),
    ...outcome.removed.map((file) => `${verb('remove')}${file}`),
    ...(outcome.blockers.length > 0
      ? ['', 'Left as functions:', ...outcome.blockers.map((line) => `  - ${line}`)]
      : []),
    ...(outcome.manual.length > 0 ? ['', 'Left to you:', ...outcome.manual.map((line) => `  - ${line}`)] : []),
  ];

  return lines.length > 0 ? lines.join('\n') : 'Nothing to do: no function route was found.';
}
