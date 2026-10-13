#!/usr/bin/env node
// What a pull request of this repository has to run: the packages its change reaches, each
// with the packages that depend on it. Everything when a file shared by all of them changed,
// when a path is not listed here, or without `--base`.
//
//   node pipeline/monorepo/affected-packages.mjs --base <git-ref> [--format github|text]
//
// The unit run takes `filters` as its path filters and `packages` as KIT_AFFECTED, which
// vitest.config.ts reads to hold the coverage floor of those packages only. The end-to-end
// suite, the example and the conformance run integrate every package: they are never narrowed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** What the specs of the CLI read outside their package: the reference, the pipeline assets, the example, the plugin, the formatter config. */
const READ_BY_THE_CLI_SPECS = ['docs/', 'pipeline/', 'examples/', 'plugin/', '.claude-plugin/', 'biome.json'];

/** Read by no spec: only the gates that always run (dashes, plugin validation) look at them. */
const DOCUMENTS = /^[^/]+\.md$|^LICENSE$/;

/** The packages whose adapter specs need a server of the integration job: PostgreSQL, or Varnish for http. */
const ON_A_SERVER = ['drizzle', 'knex', 'prisma', 'typeorm', 'audit', 'http'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

function main(args) {
  const base = valueOf(args, '--base');
  const format = valueOf(args, '--format') ?? 'text';
  const selection = base === undefined || base === '' ? everything('no base to compare with') : sinceBase(base);

  console.log(format === 'github' ? asOutputs(selection) : asText(selection));
}

function valueOf(args, flag) {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
}

function sinceBase(base) {
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', '-z', base, 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (diff.status !== 0) {
    return everything(`git cannot tell what changed since ${base}`);
  }

  return select(readGraph(ROOT), diff.stdout.split('\0').filter(Boolean));
}

/** The packages of the workspace, each with the packages of the workspace it depends on, development and peer dependencies included. */
export function readGraph(root) {
  const directories = fs.readdirSync(path.join(root, 'packages'));
  const manifests = directories.map((directory) => [directory, readManifest(root, directory)]);
  const byName = new Map(manifests.map(([directory, manifest]) => [manifest.name, directory]));

  return Object.fromEntries(
    manifests.map(([directory, manifest]) => [
      directory,
      Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
        .map((name) => byName.get(name))
        .filter((dependency) => dependency !== undefined),
    ]),
  );
}

function readManifest(root, directory) {
  return JSON.parse(fs.readFileSync(path.join(root, 'packages', directory, 'package.json'), 'utf8'));
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
  };
}

function reachOf(graph, file) {
  const [, name] = /^packages\/([^/]+)\//.exec(file) ?? [];

  if (name !== undefined) {
    return name in graph ? [name] : 'everything';
  }

  if (READ_BY_THE_CLI_SPECS.some((prefix) => file.startsWith(prefix))) {
    return ['cli'];
  }

  return DOCUMENTS.test(file) ? [] : 'everything';
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
  return { scope: 'all', reason, packages: Object.keys(graph) };
}

/** `packages` and `filters` are empty for everything: no filter, every floor held. */
function asOutputs({ scope, packages }) {
  const partial = scope === 'packages';

  return [
    `scope=${scope}`,
    `packages=${partial ? packages.join(',') : ''}`,
    `filters=${partial ? packages.map((name) => `packages/${name}/`).join(' ') : ''}`,
    `integration=${scope === 'all' || (partial && packages.some((name) => ON_A_SERVER.includes(name)))}`,
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
