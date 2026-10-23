#!/usr/bin/env node
// What a pull request of this repository has to run: the packages its change reaches, each
// with the packages that depend on it. Everything when a file shared by all of them changed,
// when a path is not listed here, or without `--base`.
//
//   node pipeline/monorepo/affected-packages.mjs --base <git-ref> [--format github|text]
//   node pipeline/monorepo/affected-packages.mjs --base <git-ref> --run <npm script>
//
// `--base` names what the change is compared with: what differs between the merge base of that
// ref and HEAD. `--run` runs an npm script on the selection, as the pipeline does on a pull
// request (the pre-push hook: `--base origin/main --run test`). Without it, the selection is
// printed. The unit run takes `filters` as its path filters and `packages` as KIT_AFFECTED, which
// vitest.config.ts reads to hold the coverage floor of those packages only. The end-to-end
// shards and the alias runs read KIT_AFFECTED too, to generate the stacks the change reaches
// (`packages/cli/test/e2e/stacks.ts`); the generated projects, the example and the conformance
// run integrate every package whole; all of them are skipped only when nothing but documents
// changed (`integrated`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** What the specs of the CLI read outside their package: the reference, the pipeline assets, the example, the plugin, the formatter config. */
const READ_BY_THE_CLI_SPECS = ['docs/', 'pipeline/', 'examples/', 'plugin/', '.claude-plugin/', 'biome.json'];

/** Read by no spec: only the gates that always run (dashes, plugin validation, the files of changes/) look at them. */
const DOCUMENTS = /^[^/]+\.md$|^LICENSE$/;

/** The documentation website, read by no spec of a package: the static checks job of the CI builds it. */
const SITE = 'site/';

/** The documents the runs that integrate every package read: the quick start of the root README, the rule table of the reference. */
const READ_BY_THE_WHOLE_RUNS = ['README.md', 'docs/ARCHITECTURE.md'];

/** The packages whose adapter specs need a server of the integration job: PostgreSQL, OpenFGA, MinIO for s3, Varnish for http, Dragonfly for redis, or the broker of nats, rabbitmq and kafka. */
export const ON_A_SERVER = [
  'drizzle',
  'knex',
  'prisma',
  'typeorm',
  'audit',
  'openfga',
  's3',
  'http',
  'redis',
  'nats',
  'rabbitmq',
  'kafka',
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

function main(args) {
  const base = valueOf(args, '--base');
  const format = valueOf(args, '--format') ?? 'text';
  const script = valueOf(args, '--run');
  const selection = base === undefined || base === '' ? everything('no base to compare with') : sinceBase(base);

  if (script !== undefined) {
    process.exit(runOn(selection, script));
  }

  console.log(format === 'github' ? asOutputs(selection) : asText(selection));
}

function valueOf(args, flag) {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
}

/**
 * Runs an npm script on the selection, as the pipeline does on a pull request: nothing when only
 * documents changed, the specs of the packages reached when some are, everything otherwise. Its
 * output goes to the terminal; its exit code is the answer.
 */
function runOn(selection, script) {
  console.log(asText(selection));

  if (selection.scope === 'none') {
    return 0;
  }

  const { args, env } = commandOf(selection, script);
  const run = spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

  return run.status ?? 1;
}

/** The npm command of a script on the selection: the packages reached as path filters, and KIT_AFFECTED as the unit run reads it. */
export function commandOf({ scope, packages }, script) {
  const partial = scope === 'packages';

  return {
    args: ['run', script, '--', ...(partial ? packages.map((name) => `packages/${name}/`) : [])],
    env: { KIT_AFFECTED: partial ? packages.join(',') : '' },
  };
}

/** The files that differ between the merge base of `base` and HEAD: what the branch changed, whether or not the base moved on. */
function sinceBase(base) {
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (diff.status !== 0) {
    return everything(`git cannot tell what changed since ${base}`);
  }

  return select(readGraph(ROOT), diff.stdout.split('\0').filter(Boolean));
}

/**
 * The packages of the workspace, each with the packages of the workspace it depends on, development
 * and peer dependencies included, and the packages whose sources its specs import by a relative path:
 * a spec that replays the code of another package must run when that code changes, and counts in
 * the coverage of that package.
 */
export function readGraph(root) {
  const directories = fs.readdirSync(path.join(root, 'packages'));
  const manifests = directories.map((directory) => [directory, readManifest(root, directory)]);
  const byName = new Map(manifests.map(([directory, manifest]) => [manifest.name, directory]));

  return Object.fromEntries(
    manifests.map(([directory, manifest]) => [
      directory,
      [
        ...new Set([
          ...Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
            .map((name) => byName.get(name))
            .filter((dependency) => dependency !== undefined),
          ...sourcesReadBySpecs(root, directory).filter((name) => name !== directory && directories.includes(name)),
        ]),
      ],
    ]),
  );
}

function readManifest(root, directory) {
  return JSON.parse(fs.readFileSync(path.join(root, 'packages', directory, 'package.json'), 'utf8'));
}

/** `'../../cli/src/...'` in a spec or a support file of `test/`: the name of the package it reaches into. */
function sourcesReadBySpecs(root, directory) {
  const tests = path.join(root, 'packages', directory, 'test');

  if (!fs.existsSync(tests)) {
    return [];
  }

  return fs
    .readdirSync(tests, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?ts$/.test(entry.name))
    .flatMap((entry) => [
      ...fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8').matchAll(/['"](?:\.\.\/)+([\w-]+)\/src\//g),
    ])
    .map(([, name]) => name);
}

/** `graph` maps a package to what it depends on; `changed` are paths from the root of the repository. */
export function select(graph, changed) {
  const reached = new Set();

  for (const file of changed) {
    const reach = reachOf(graph, file);

    if (reach === 'everything') {
      return everything(`${file} is shared by every package`, graph);
    }

    for (const name of reach) {
      reached.add(name);
      dependentsOf(graph, name).forEach((dependent) => reached.add(dependent));
    }
  }

  const packages = Object.keys(graph).filter((name) => reached.has(name));

  if (packages.length === Object.keys(graph).length) {
    return everything('every package is reached', graph);
  }

  return {
    scope: packages.length === 0 ? 'none' : 'packages',
    reason: 'the changed packages and the packages that depend on them',
    packages,
    integrated: changed.some(integrates),
  };
}

/**
 * Whether a changed file reaches the runs that integrate every package. A document they do not
 * read does not: a page of docs/, a skill, a README of a package, the website, a file of changes/.
 * What the generators write (packages/<name>/templates/) and the example do.
 */
function integrates(file) {
  const document =
    file.endsWith('.md') &&
    !file.startsWith('examples/') &&
    !/^packages\/[^/]+\/templates\//.test(file) &&
    !READ_BY_THE_WHOLE_RUNS.includes(file);

  return !(document || file === 'LICENSE' || file.startsWith(SITE) || file.startsWith('docs/assets/'));
}

function reachOf(graph, file) {
  const [, name] = /^packages\/([^/]+)\//.exec(file) ?? [];

  if (name !== undefined) {
    return name in graph ? [name] : 'everything';
  }

  if (READ_BY_THE_CLI_SPECS.some((prefix) => file.startsWith(prefix))) {
    return ['cli'];
  }

  return DOCUMENTS.test(file) || file.startsWith(SITE) || file.startsWith('changes/') ? [] : 'everything';
}

/** Every package that depends on `name`, directly or through another. */
export function dependentsOf(graph, name) {
  const found = new Set();
  const pending = [name];

  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const [candidate, dependencies] of Object.entries(graph)) {
      if (!found.has(candidate) && dependencies.includes(current)) {
        found.add(candidate);
        pending.push(candidate);
      }
    }
  }

  found.delete(name);

  return [...found];
}

function everything(reason, graph = readGraph(ROOT)) {
  return { scope: 'all', reason, packages: Object.keys(graph), integrated: true };
}

/** `packages` and `filters` are empty for everything: no filter, every floor held. */
/** The outputs of the install job: what the other jobs of the CI read, among them whether the integration job starts its servers. */
export function asOutputs({ scope, packages, integrated }) {
  const partial = scope === 'packages';

  return [
    `scope=${scope}`,
    `packages=${partial ? packages.join(',') : ''}`,
    `filters=${partial ? packages.map((name) => `packages/${name}/`).join(' ') : ''}`,
    `integration=${scope === 'all' || (partial && packages.some((name) => ON_A_SERVER.includes(name)))}`,
    `integrated=${integrated}`,
  ].join('\n');
}

function asText({ scope, reason, packages }) {
  if (scope === 'all') {
    return `Everything is affected: ${reason}.`;
  }

  return scope === 'none'
    ? 'No package is affected: only documents changed.'
    : `Affected packages: ${packages.join(', ')} (${reason}).`;
}
