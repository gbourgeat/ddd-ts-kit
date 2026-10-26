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

/** Run by jobs of their own: the alias at run time on both Node lines, the real installs per package manager, the pairwise stacks and the first migrations on a real PostgreSQL at night and before a release. */
export const ELSEWHERE = [
  /^alias-.*\.spec\.ts$/,
  /^pairwise\.spec\.ts$/,
  /^migrations-for-real\.spec\.ts$/,
  /^package-managers\.spec\.ts$/,
  /^first-minute(?:-proven|-js)?\.spec\.ts$/,
];

/**
 * One list per runner, with the seconds each file took on a runner of the pipeline (the median of
 * the 16 runs of the trunk and of pull requests of 2026-10-26, four cores, the files one after the
 * other), each file given, longest first, to the runner with the most room. The earlier table
 * (2026-10-23) had the two `first-minute` sweeps at 312 and 322 seconds; they doubled to 664 and 661
 * as the templates grew, and the third runner ended at 1,195 s against 593 s for the first. The
 * runners now end at 870, 867, 870 and 873 seconds. The two sweeps are not split in halves: each is
 * shorter than a runner's share, so a split would not shorten the longest runner.
 */
export const SHARDS = [
  {
    'first-minute-no-context.spec.ts': 664,
    // oRPC and tRPC on the four servers and on Nest controllers.
    'rpc-procedures.spec.ts': 122,
    'event-sourced.spec.ts': 56,
    // A multi-tenant project with a service, its roots composed.
    'service-composition.spec.ts': 16,
    'client-sdk.spec.ts': 12,
  },
  {
    'first-minute-two-contexts.spec.ts': 661,
    // The Jest stack too.
    'typecheck.spec.ts': 130,
    'preset-identity-generated.spec.ts': 39,
    'error-reporting.spec.ts': 20,
    // Every route generator on Nest controllers, one project.
    'nest-controllers.spec.ts': 13,
    'platform-error-mapper.spec.ts': 2,
    // A copy of the example application, merge-trunk run in two of its worktrees.
    'merge-trunk-example.spec.ts': 2,
  },
  {
    'coverage-gate.spec.ts': 519,
    'first-class.spec.ts': 208,
    'contract-pairs.spec.ts': 60,
    'formatted.spec.ts': 56,
    'error-rule-violations.spec.ts': 15,
    // A repository that declares personal columns, with the erasure of its context, installed as published.
    'personal-fields.spec.ts': 12,
  },
  {
    // With NestJS on Nest controllers and Passport.
    'proven-stacks.spec.ts': 362,
    'preset-identity.spec.ts': 303,
    'new-rule-violations.spec.ts': 74,
    'zero-violation.spec.ts': 57,
    'file-uploads.spec.ts': 34,
    'violations.spec.ts': 20,
    'manual-module.spec.ts': 12,
    'dev-reload.spec.ts': 11,
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
