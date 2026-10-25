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

/**
 * One list per runner, with the seconds each file took on a runner of the pipeline (run 40006101911
 * of the trunk, 2026-10-23, four cores, the files one after the other), each file given, longest
 * first, to the runner with the most room. The earlier table (2026-10-12) held the seconds of a
 * workstation, which the runners took two to three times longer over; the third runner ended at
 * 715 s against 352 s for the first.
 */
export const SHARDS = [
  {
    'proven-stacks.spec.ts': 371,
    'new-rule-violations.spec.ts': 65,
    'zero-violation.spec.ts': 33,
    'event-sourced.spec.ts': 19,
    // A repository that declares personal columns, with the erasure of its context, installed as published.
    'personal-fields.spec.ts': 20,
    'formatted.spec.ts': 29,
  },
  {
    'coverage-gate.spec.ts': 328,
    'typecheck.spec.ts': 70,
    // oRPC and tRPC on the four servers (run 40182551102 of the pull request that added tRPC).
    'rpc-procedures.spec.ts': 66,
    'violations.spec.ts': 15,
    'preset-identity-generated.spec.ts': 25,
    'error-rule-violations.spec.ts': 11,
    'client-sdk.spec.ts': 9,
    // A copy of the example application, merge-trunk run in two of its worktrees.
    'merge-trunk-example.spec.ts': 2,
  },
  {
    'first-minute-two-contexts.spec.ts': 322,
    'preset-identity.spec.ts': 135,
    // With the client SDK of each pair.
    'contract-pairs.spec.ts': 38,
    'file-uploads.spec.ts': 26,
    'error-reporting.spec.ts': 17,
  },
  { 'first-minute-no-context.spec.ts': 312, 'first-class.spec.ts': 209, 'dev-reload.spec.ts': 9 },
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

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main(process.argv.slice(2)));
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
      // One file at a time: these files run the specs of generated projects under coverage, which time out at
      // five seconds when two projects share the four cores of a runner (seen on the second shard, 2026-10-23);
      // the runners are balanced on measured seconds instead (SHARDS).
      '--no-file-parallelism',
      '--hookTimeout=180000',
      ...files.map((file) => `${DIRECTORY}/${file}`),
      ...passed,
    ],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, DDD_TS_KIT_E2E: '1' } },
  );

  return run.status ?? 1;
}
