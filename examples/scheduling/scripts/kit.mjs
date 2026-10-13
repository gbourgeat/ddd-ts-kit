// Runs the ddd-ts-kit CLI for this example and measures it: every `generate` and `docs` is
// serialised behind a lock (several workers share one tree here), logged with its duration, and
// its output is accumulated in `node_modules/.cache/ddd-ts-kit-example/generated/` of the repository, the copy of the tree as the generators
// alone wrote it. `scripts/measure-tooling.mjs` compares that copy with the tree.
//
//   node scripts/kit.mjs generate command scheduling BookAppointment --aggregate Appointment --permission appointment.book --json
//   KIT_WORKER=identity node scripts/kit.mjs generate ...
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.resolve(root, '../../packages/cli/dist/bin.js');
// Outside the project: a copy of the sources inside it would be linted and compiled with it.
const stateDir = path.resolve(root, '../../node_modules/.cache/ddd-ts-kit-example');
const snapshotDir = path.join(stateDir, 'generated');
const logFile = path.join(stateDir, 'generator-log.jsonl');
// With the rest of the state, not in the shared temporary directory: nothing is left behind there.
const lockFile = path.join(stateDir, 'generate.lock');
// Before `main()` runs: a constant declared below it would not be initialised yet.
const NOT_A_FILE = ['ENOENT', 'ENOTDIR', 'EISDIR'];
const args = process.argv.slice(2);
const command = args[0] === 'g' ? 'generate' : args[0];

main();

function main() {
  if (command !== 'generate' && command !== 'docs') {
    return passThrough();
  }
  if (args.includes('--dry-run') || args.includes('--help') || args.includes('--check')) {
    return passThrough();
  }
  if (process.env.KIT_LOCKED !== '1') {
    return underLock();
  }

  fs.mkdirSync(snapshotDir, { recursive: true });

  const started = Date.now();
  const planned = command === 'generate' ? plannedFiles() : regeneratedByDocs();
  const before = new Map(planned.map((file) => [file, read(file)]));
  const run = spawnSync(process.execPath, [cli, ...args, '--cwd', root], { encoding: 'utf8' });

  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);

  const result = parse(run.stdout);
  const touched = result === undefined ? planned : [...(result.created ?? []), ...(result.updated ?? [])];

  for (const file of new Set([...touched, ...planned])) {
    accumulate(file, before.get(file));
  }

  log({
    at: new Date().toISOString(),
    worker: process.env.KIT_WORKER ?? 'conductor',
    command,
    kind: command === 'generate' ? args[1] : 'docs',
    args: args.slice(1).filter((arg) => arg !== '--json'),
    ms: Date.now() - started,
    exit: run.status,
    created: result?.created?.length ?? 0,
    updated: result?.updated?.length ?? 0,
    todos: result?.todos?.length ?? 0,
    notes: result?.notes ?? [],
  });
  process.exit(run.status ?? 1);
}

function passThrough() {
  const run = spawnSync(process.execPath, [cli, ...args, '--cwd', root], { stdio: 'inherit' });

  process.exit(run.status ?? 1);
}

function underLock() {
  fs.mkdirSync(stateDir, { recursive: true });

  const run = spawnSync('flock', [lockFile, process.execPath, fileURLToPath(import.meta.url), ...args], {
    stdio: 'inherit',
    env: { ...process.env, KIT_LOCKED: '1' },
  });

  process.exit(run.status ?? 1);
}

/** What a generator is about to create or update, asked with a dry run. */
function plannedFiles() {
  const dry = spawnSync(
    process.execPath,
    [cli, ...args.filter((arg) => arg !== '--json'), '--dry-run', '--json', '--cwd', root],
    { encoding: 'utf8' },
  );
  const result = parse(dry.stdout);

  return result === undefined ? [] : [...(result.created ?? []), ...(result.updated ?? [])];
}

/** `docs` answers no list: the files it may rewrite are known by their names. */
function regeneratedByDocs() {
  const contexts = path.join(root, 'src/contexts');
  const names = fs.existsSync(contexts) ? fs.readdirSync(contexts) : [];

  return [
    'docs/context-map.md',
    ...names.flatMap((name) => [`src/contexts/${name}/CONTEXT.md`, `src/contexts/${name}/${name}.declarations.ts`]),
  ];
}

/** Keeps the copy equal to what generators wrote: a new file is copied, an updated one takes the generator's change only. */
function accumulate(file, previous) {
  const current = read(file);
  const copy = path.join(snapshotDir, file);

  if (current === undefined || current === previous) {
    return;
  }

  fs.mkdirSync(path.dirname(copy), { recursive: true });

  if (previous === undefined || !fs.existsSync(copy)) {
    if (previous === undefined) {
      fs.writeFileSync(copy, current);
    }

    return;
  }

  const beforeFile = path.join(stateDir, 'before.tmp');

  fs.writeFileSync(beforeFile, previous);

  const diff = spawnSync('diff', ['-u', beforeFile, path.join(root, file)], { encoding: 'utf8' });
  const patch = spawnSync('patch', ['--quiet', '--no-backup-if-mismatch', '-r', '-', copy], {
    input: diff.stdout,
    encoding: 'utf8',
  });

  if (patch.status !== 0) {
    log({
      at: new Date().toISOString(),
      command: 'snapshot',
      file,
      note: 'the generator change did not apply to the copy; left as it was',
    });
  }

  fs.rmSync(beforeFile, { force: true });
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch (error) {
    if (NOT_A_FILE.includes(error?.code)) {
      return undefined;
    }

    throw error;
  }
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function log(entry) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}
