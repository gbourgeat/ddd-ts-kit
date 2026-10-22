import fs from 'node:fs';
import path from 'node:path';
import { readConfig, type Config } from '../config';
import { barrelFile, generatedDrift, singleFileNotice } from '../declared';
import { readContexts } from '../docs/read-contexts';
import { writeDocs } from '../docs/write-docs';
import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file';
import { formerlyRecordedStoredEvents } from '../docs/formerly-recorded-stored-events';
import { unrecordedStoredEvents } from '../docs/unrecorded-stored-events';
import { writeStoredEventsLock } from '../docs/write-stored-events-lock';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';
import { printReport } from './print-report';

export const docsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'stored-events': { type: 'boolean', default: false },
  });

  const ws = new Workspace(args.projectRoot, false);

  const { config } = readConfig(args.projectRoot);
  const check = args.flag('check');

  // A check writes nothing: a context still declared in the single file of 0.84 is only warned about.
  const singleFile = writeDocs(ws, config, check ? 'keep' : 'move');

  if (args.flag('stored-events')) {
    recordStoredEvents(ws, config);
  }

  if (!check) {
    stopIgnoringValidation(ws, config);
    printReport(io, args, ws.commit(args.flag('dry-run')));

    return 0;
  }

  return reportCheck(io, args, { ws, config, singleFile });
};

interface DocsRun {
  readonly ws: Workspace;
  readonly config: Config;
  /** The contexts still declared in the single file of 0.84: a warning, not a failure, in this version. */
  readonly singleFile: readonly string[];
}

/** `docs --check`: the generated files that would change, and the stored-event versions not recorded yet or recorded by 0.82.0 or earlier; 0 when there is none. */
function reportCheck(io: Io, args: Arguments, { ws, config, singleFile }: DocsRun): number {
  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated, ...report.deleted];
  const drift = Object.fromEntries(stale.flatMap((file) => driftOf(ws.root, ws, file)));
  const recording = args.flag('stored-events');
  const unrecorded = recording ? [] : unrecordedStoredEvents(ws, config, contextsOnDisk(ws, config));
  const formerlyRecorded = recording ? [] : formerlyRecordedStoredEvents(ws, config, contextsOnDisk(ws, config));
  const ok = stale.length === 0 && unrecorded.length === 0 && formerlyRecorded.length === 0;
  const warnings = singleFile.map((context) => singleFileWarning(config, context));

  if (args.json) {
    io.out(JSON.stringify({ ok, stale, drift, unrecorded, formerlyRecorded, warnings }, null, 2));
  } else if (ok) {
    io.out(['The generated documentation is up to date.', ...warningLines(warnings)].join('\n'));
  } else {
    io.out([...staleLines(stale, drift, { unrecorded, formerlyRecorded }), ...warningLines(warnings)].join('\n'));
  }

  return ok ? 0 : 1;
}

/** A context still declared in the single file of 0.84, as `docs --check` warns about it. */
interface SingleFileWarning {
  readonly file: string;
  readonly message: string;
  readonly fix: string;
}

function singleFileWarning(config: Config, context: string): SingleFileWarning {
  return { file: `${config.contextsDir}/${context}/${barrelFile(context)}`, ...singleFileNotice(context) };
}

function warningLines(warnings: readonly SingleFileWarning[]): string[] {
  return warnings.flatMap(({ file, message, fix }) => ['', `warning  ${file}: ${message}`, `  ${fix}`]);
}

/** The versions of stored events `docs --check` holds against the lock. */
interface LockGaps {
  readonly unrecorded: readonly string[];
  readonly formerlyRecorded: readonly string[];
}

function staleLines(
  stale: readonly string[],
  drift: Readonly<Record<string, string>>,
  { unrecorded, formerlyRecorded }: LockGaps,
): string[] {
  const lines = stale.map((file) => `stale  ${file}${drift[file] === undefined ? '' : `: ${drift[file]}`}`);
  const versions = unrecorded.map((version) => `unrecorded  ${version} in ${STORED_EVENTS_LOCK}`);

  const former = formerlyRecorded.map(
    (version) => `formerly recorded  ${version} in ${STORED_EVENTS_LOCK}, by 0.82.0 or earlier`,
  );

  const runDocs = stale.length === 0 ? [] : ['Run `ddd-ts-kit docs` and commit the result.'];

  const recordAgain =
    formerlyRecorded.length === 0
      ? []
      : [
          'Run `ddd-ts-kit docs --stored-events` and commit the lock: it records these versions again as the kit reads them now, where two shapes no longer share a fingerprint.',
        ];

  const runStoredEvents =
    unrecorded.length === 0
      ? []
      : [
          'Once the shape of these versions is the one to keep, run `ddd-ts-kit docs --stored-events` and commit the lock: event-sourcing/upcaster-required then refuses any change of it.',
        ];

  return [...lines, ...versions, ...former, '', ...runDocs, ...runStoredEvents, ...recordAgain];
}

function contextsOnDisk(ws: Workspace, config: Config): string[] {
  return readContexts(ws, config)
    .filter((context) => context.onDisk)
    .map((context) => context.name);
}

/** Recorded on purpose, when a version starts being stored where it is kept: a shape still in the making stays free. */
function recordStoredEvents(ws: Workspace, config: Config): void {
  writeStoredEventsLock(ws, config, contextsOnDisk(ws, config));
}

const GENERATED_CONTEXT_FILE = /\.(?:declarations|dependencies)\.ts$/;

/** What makes a generated file of a context stale, in words: the role file it misses, or the class whose constructor changed. */
function driftOf(root: string, ws: Workspace, file: string): [string, string][] {
  if (!GENERATED_CONTEXT_FILE.test(file)) {
    return [];
  }

  const expected = ws.read(file);

  if (expected === undefined) {
    return [[file, 'it is no longer generated: its folder holds no declared class']];
  }

  const written = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';

  return [[file, written === '' ? 'it is missing' : generatedDrift(written, expected)]];
}
