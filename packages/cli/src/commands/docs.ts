import fs from 'node:fs';
import path from 'node:path';
import { readConfig, type Config } from '../config/index.js';
import { generatedDrift } from '../declared/index.js';
import { readContexts } from '../docs/read-contexts.js';
import { writeDocs } from '../docs/write-docs.js';
import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file.js';
import { unrecordedStoredEvents } from '../docs/unrecorded-stored-events.js';
import { writeStoredEventsLock } from '../docs/write-stored-events-lock.js';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';
import { printReport } from './print-report.js';

export const docsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'stored-events': { type: 'boolean', default: false },
  });

  const ws = new Workspace(args.projectRoot, false);

  const { config } = readConfig(args.projectRoot);

  writeDocs(ws, config);

  if (args.flag('stored-events')) {
    recordStoredEvents(ws, config);
  }

  if (!args.flag('check')) {
    stopIgnoringValidation(ws, config);
    printReport(io, args, ws.commit(args.flag('dry-run')));

    return 0;
  }

  return reportCheck(io, args, { ws, config });
};

interface DocsRun {
  readonly ws: Workspace;
  readonly config: Config;
}

/** `docs --check`: the generated files that would change, and the stored-event versions not recorded yet; 0 when there is none. */
function reportCheck(io: Io, args: Arguments, { ws, config }: DocsRun): number {
  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated];
  const drift = Object.fromEntries(stale.flatMap((file) => driftOf(ws.root, ws, file)));
  const unrecorded = args.flag('stored-events') ? [] : unrecordedStoredEvents(ws, config, contextsOnDisk(ws, config));
  const ok = stale.length === 0 && unrecorded.length === 0;

  if (args.json) {
    io.out(JSON.stringify({ ok, stale, drift, unrecorded }, null, 2));
  } else if (ok) {
    io.out('The generated documentation is up to date.');
  } else {
    io.out(staleLines(stale, drift, unrecorded).join('\n'));
  }

  return ok ? 0 : 1;
}

function staleLines(
  stale: readonly string[],
  drift: Readonly<Record<string, string>>,
  unrecorded: readonly string[],
): string[] {
  const lines = stale.map((file) => `stale  ${file}${drift[file] === undefined ? '' : `: ${drift[file]}`}`);
  const versions = unrecorded.map((version) => `unrecorded  ${version} in ${STORED_EVENTS_LOCK}`);
  const runDocs = stale.length === 0 ? [] : ['Run `ddd-ts-kit docs` and commit the result.'];

  const runStoredEvents =
    unrecorded.length === 0
      ? []
      : [
          'Once the shape of these versions is the one to keep, run `ddd-ts-kit docs --stored-events` and commit the lock: event-sourcing/upcaster-required then refuses any change of it.',
        ];

  return [...lines, ...versions, '', ...runDocs, ...runStoredEvents];
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
  const expected = GENERATED_CONTEXT_FILE.test(file) ? ws.read(file) : undefined;

  if (expected === undefined) {
    return [];
  }

  const written = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';

  return [[file, written === '' ? 'it is missing' : generatedDrift(written, expected)]];
}
