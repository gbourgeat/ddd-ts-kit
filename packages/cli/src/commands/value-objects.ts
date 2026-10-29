import { readConfig } from '../config';
import { MigrationDraft } from '../refusals/migration-draft';
import { throwingValueObjects } from '../value-objects/throwing-value-objects';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';
import { stdoutJson } from '../json/stdout-json';

const MANUAL = [
  'Run the formatter, then the checks and the tests: a caller that branched on `.ok` or read `.error` now catches, or lets the refusal go up.',
  'A spec that expected facts with the code of a refusal is said above: write it `expectRefusal(() => Concept.create(raw), code, facts)`.',
];

/** Moves the value objects of a project from a `Result` to factories that return the value or throw. */
export const valueObjectsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { 'dry-run': { type: 'boolean', default: false } });
  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const draft = new MigrationDraft(ws);
  const migration = throwingValueObjects({ ws, config }, draft);

  const outcome: Outcome = {
    dryRun: args.flag('dry-run'),
    ...migration,
    written: draft.written,
    manual: [...draft.manual, ...(migration.converted.length > 0 ? MANUAL : [])],
  };

  if (!outcome.dryRun) {
    draft.commit();
  }

  print(io, args.json, outcome);

  return 0;
};

interface Outcome {
  readonly dryRun: boolean;
  readonly converted: readonly string[];
  readonly throws: number;
  readonly unwraps: number;
  readonly assertions: number;
  readonly written: readonly string[];
  readonly manual: readonly string[];
}

function print(io: Io, json: boolean, outcome: Outcome): void {
  if (json) {
    io.out(stdoutJson(outcome));

    return;
  }

  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);
  const counts = `${outcome.throws} refusals thrown, ${outcome.unwraps} unwrap removed, ${outcome.assertions} assertions rewritten`;

  const lines = [
    ...outcome.converted.map((method) => `${verb('convert')}${method}`),
    ...outcome.written.map((file) => `${verb('write')}${file}`),
    ...(outcome.converted.length > 0 ? ['', counts] : []),
    ...(outcome.manual.length > 0 ? ['', 'Left to you:', ...outcome.manual.map((line) => `  - ${line}`)] : []),
  ];

  io.out(lines.length > 0 ? lines.join('\n') : 'Nothing to do.');
}
