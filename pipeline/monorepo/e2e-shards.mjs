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
  /^mutation-on-managers\.spec\.ts$/,
  /^first-minute(?:-proven|-js)?\.spec\.ts$/,
];

/**
 * One list per runner, with the seconds each file took on a runner of the pipeline (the run of pull
 * request #419 on 2026-10-26, the first with the cover of 16 stacks and the deep runs moved to the
 * night: the first-minute sweeps fell from about 660 to 151 and 234 s, proven-stacks grew from 362 to
 * 469 s, and the coverage gate runs on one stack, counted 60 s), each file given, longest first, to
 * the runner with the most room. The fourth runner ended at 1,047 s against 330 s for the first; the
 * runners now end at 550, 546, 547, 550 seconds.
 */
export const SHARDS = [
  {
    // With NestJS on Nest controllers and Passport.
    'proven-stacks.spec.ts': 469,
    'event-sourced.spec.ts': 38,
    'violations.spec.ts': 20,
    // Every route generator on Nest controllers, one project.
    'nest-controllers.spec.ts': 14,
    'client-sdk.spec.ts': 9,
  },
  {
    'preset-identity.spec.ts': 314,
    // oRPC and tRPC on the four servers and on Nest controllers.
    'rpc-procedures.spec.ts': 87,
    'zero-violation.spec.ts': 62,
    'preset-identity-generated.spec.ts': 42,
    'error-reporting.spec.ts': 24,
    'manual-module.spec.ts': 14,
    // A copy of the example application, merge-trunk run in two of its worktrees.
    'merge-trunk-example.spec.ts': 3,
  },
  {
    'first-minute-two-contexts.spec.ts': 234,
    // The Jest stack too.
    'typecheck.spec.ts': 142,
    'contract-pairs.spec.ts': 62,
    'coverage-gate.spec.ts': 60,
    'file-uploads.spec.ts': 34,
    // A repository that declares personal columns, with the erasure of its context, installed as published.
    'personal-fields.spec.ts': 13,
    'platform-error-mapper.spec.ts': 2,
  },
  {
    'first-class.spec.ts': 213,
    'first-minute-no-context.spec.ts': 151,
    'new-rule-violations.spec.ts': 86,
    'formatted.spec.ts': 57,
    // A multi-tenant project with a service, its roots composed.
    'service-composition.spec.ts': 16,
    'error-rule-violations.spec.ts': 16,
    'dev-reload.spec.ts': 11,
  },
];

/**
 * On a workstation the projects these specs generate start two Vitest workers, not half the cores each (a family run
 * reached about 2.5 GB with two files at a time, docs/proposals/generated-project-families.md); a pipeline runner has its
 * own cores, and a value set in the environment wins.
 */
const WORKERS = process.env['CI'] ? {} : { VITEST_MAX_WORKERS: '2' };

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
    { cwd: ROOT, stdio: 'inherit', env: { ...WORKERS, ...process.env, DDD_TS_KIT_E2E: '1' } },
  );

  return run.status ?? 1;
}
