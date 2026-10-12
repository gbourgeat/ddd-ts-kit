import fs from 'node:fs';
import path from 'node:path';
import { readConfig, type Config } from '../config/index.js';
import { generatedDrift } from '../declared/index.js';
import { readContexts } from '../docs/read-contexts.js';
import { writeDocs } from '../docs/write-docs.js';
import { writeStoredEventsLock } from '../docs/write-stored-events-lock.js';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { printReport } from './print-report.js';

export const docsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'stored-events': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const ws = new Workspace(root, false);

  const { config } = readConfig(root);

  writeDocs(ws, config);

  if (args.flag('stored-events')) {
    recordStoredEvents(ws, config);
  }

  if (!args.flag('check')) {
    stopIgnoringValidation(ws, config);
    printReport(io, args, ws.commit(args.flag('dry-run')));

    return 0;
  }

  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated];
  const drift = Object.fromEntries(stale.flatMap((file) => driftOf(root, ws, file)));

  if (args.json) {
    io.out(JSON.stringify({ ok: stale.length === 0, stale, drift }, null, 2));
  } else if (stale.length === 0) {
    io.out('The generated documentation is up to date.');
  } else {
    const lines = stale.map((file) => `stale  ${file}${drift[file] === undefined ? '' : `: ${drift[file]}`}`);

    io.out([...lines, '', 'Run `ddd-ts-kit docs` and commit the result.'].join('\n'));
  }

  return stale.length === 0 ? 0 : 1;
};

/** Recorded on purpose, when a version starts being stored where it is kept: a shape still in the making stays free. */
function recordStoredEvents(ws: Workspace, config: Config): void {
  const contexts = readContexts(ws, config).filter((context) => context.onDisk);

  writeStoredEventsLock(
    ws,
    config,
    contexts.map((context) => context.name),
  );
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
