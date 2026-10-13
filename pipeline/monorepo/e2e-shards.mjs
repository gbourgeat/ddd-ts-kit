#!/usr/bin/env node
/**
 * The end-to-end specs of the generated stacks, split between the runners of the pipeline by an
 * explicit assignment. The test runner shards by the hash of a file name, which put three long
 * files on one runner and two short ones on another (145, 257, 285 and 29 seconds); here each
 * file is given a runner by its measured duration, so that the longest runner is as short as
 * the longest file allows.
 *
 *   node pipeline/monorepo/e2e-shards.mjs                 every file, on one machine
 *   node pipeline/monorepo/e2e-shards.mjs --shard=2/4     the files of the second runner
 *
 * Any other argument is given to the test runner. A spec file that is assigned to no runner
 * stops every run: a new file is placed here, on the runner that has the most room.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIRECTORY = 'packages/cli/test/e2e';

/** Run by jobs of their own: the alias at run time on both Node lines, and the real installs per package manager. */
export const ELSEWHERE = [
  /^alias-.*\.spec\.ts$/,
  /^package-managers\.spec\.ts$/,
  /^first-minute(?:-proven|-js)?\.spec\.ts$/,
];

/** One list per runner, with the seconds each file took on the machine that measured it (2026-10-12). */
export const SHARDS = [
  { 'first-minute-no-context.spec.ts': 181, 'dev-reload.spec.ts': 8, 'formatted.spec.ts': 8 },
  { 'first-minute-two-contexts.spec.ts': 184, 'error-reporting.spec.ts': 10, 'client-sdk.spec.ts': 8 },
  { 'proven-stacks.spec.ts': 106, 'first-class.spec.ts': 68, 'error-rule-violations.spec.ts': 20 },
  {
    'coverage-gate.spec.ts': 88,
    'file-uploads.spec.ts': 30,
    'new-rule-violations.spec.ts': 25,
    'typecheck.spec.ts': 19,
    'event-sourced.spec.ts': 19,
    'violations.spec.ts': 8,
    'zero-violation.spec.ts': 8,
  },
];

/** The spec files of the directory that a shard has to run. */
export function specFiles(root = ROOT) {
  return fs
    .readdirSync(path.join(root, DIRECTORY))
    .filter((file) => file.endsWith('.spec.ts') && !ELSEWHERE.some((pattern) => pattern.test(file)))
    .sort();
}

/** What is wrong with the assignment for these files: one that no runner has, one that two have, one that is gone. */
export function problems(files, shards = SHARDS) {
  const assigned = shards.flatMap((shard) => Object.keys(shard));

  return [
    ...files.filter((file) => !assigned.includes(file)).map((file) => `${file} is assigned to no runner`),
    ...assigned.filter((file, index) => assigned.indexOf(file) !== index).map((file) => `${file} is assigned twice`),
    ...assigned.filter((file) => !files.includes(file)).map((file) => `${file} no longer exists`),
  ];
}

/** The files of `--shard=<index>/<count>`, every file without the flag; nothing when the flag names no runner. */
export function selected(args, shards = SHARDS) {
  const shard = args.map((arg) => /^--shard=(\d+)\/(\d+)$/.exec(arg)).find((found) => found !== null);

  if (shard === undefined) {
    return shards.flatMap((entry) => Object.keys(entry));
  }

  const [index, count] = [Number(shard[1]), Number(shard[2])];

  return count === shards.length && index >= 1 && index <= count ? Object.keys(shards[index - 1]) : undefined;
}

function main(args) {
  const wrong = problems(specFiles());
  const files = selected(args);

  if (wrong.length > 0 || files === undefined) {
    console.error(
      wrong.length > 0
        ? `The end-to-end shards do not cover ${DIRECTORY}:\n  ${wrong.join('\n  ')}\nEdit SHARDS in pipeline/monorepo/e2e-shards.mjs.`
        : `--shard names one of ${SHARDS.length} runners, as --shard=<1 to ${SHARDS.length}>/${SHARDS.length}.`,
    );

    return 2;
  }

  const passed = args.filter((arg) => !arg.startsWith('--shard='));
  const runner = path.join(ROOT, 'node_modules/vitest/vitest.mjs');

  const run = spawnSync(
    process.execPath,
    [
      runner,
      'run',
      '--no-file-parallelism',
      '--hookTimeout=180000',
      ...files.map((file) => `${DIRECTORY}/${file}`),
      ...passed,
    ],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, DDD_TS_KIT_E2E: '1' } },
  );

  return run.status ?? 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main(process.argv.slice(2)));
}
