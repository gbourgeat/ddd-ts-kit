import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { asOutputs, dependentsOf, readGraph, select } from './affected-packages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const graph = readGraph(ROOT);
const names = Object.keys(graph);

/** The oracle, written the other way round: a package depends on another when walking its dependencies reaches it. */
function dependsOn(name, target, seen = []) {
  return graph[name].some(
    (dependency) =>
      dependency === target || (!seen.includes(dependency) && dependsOn(dependency, target, [...seen, name])),
  );
}

test('reads the dependency graph of the workspace from the manifests', () => {
  assert.ok(names.includes('cli') && names.includes('kernel'));
  assert.ok(graph.events.includes('kernel'));
  assert.deepEqual(graph.kernel, []);
});

test('a package whose specs replay the sources of another is selected when those sources change', () => {
  // The classification spec of the ESLint plugin imports the classification of the CLI checker.
  assert.ok(graph['eslint-plugin'].includes('cli'));
  assert.ok(select(graph, ['packages/cli/src/check/project/locate.ts']).packages.includes('eslint-plugin'));
});

test('a changed package is selected with every package that depends on it, whichever package changes', () => {
  for (const name of names) {
    const { packages } = select(graph, [`packages/${name}/src/index.ts`]);
    const needed = names.filter((candidate) => candidate === name || dependsOn(candidate, name));

    assert.deepEqual(
      needed.filter((candidate) => !packages.includes(candidate)),
      [],
      `${name} changed`,
    );
    assert.deepEqual(new Set(dependentsOf(graph, name)), new Set(needed.filter((candidate) => candidate !== name)));
  }
});

test('a leaf is selected alone, the kernel selects every package that is built on it', () => {
  assert.deepEqual(select(graph, ['packages/winston/src/index.ts']), {
    scope: 'packages',
    reason: 'the changed packages and the packages that depend on them',
    packages: ['winston'],
  });

  // The ESLint plugin does not build on the kernel, but its specs replay the checker of the CLI, which does.
  assert.deepEqual(select(graph, ['packages/kernel/src/index.ts']).packages, names);
});

test('what the specs of the CLI read outside their package selects the CLI and what replays it', () => {
  for (const file of [
    'docs/ARCHITECTURE.md',
    'pipeline/lefthook.yml',
    'examples/scheduling/package.json',
    'plugin/skills/start/SKILL.md',
    'biome.json',
  ]) {
    assert.deepEqual(select(graph, [file]).packages, ['cli', 'eslint-plugin'], file);
  }
});

test('a shared file, an unknown package or a path nobody listed selects everything', () => {
  for (const file of [
    'package.json',
    'package-lock.json',
    'vitest.config.ts',
    'tsconfig.base.json',
    '.github/workflows/ci.yml',
    'packages/unknown/src/index.ts',
    'some/new/file.txt',
  ]) {
    const selection = select(graph, ['packages/winston/src/index.ts', file]);

    assert.equal(selection.scope, 'all', file);
    assert.deepEqual(selection.packages, names, file);
  }
});

test('documents no spec reads select nothing, the website neither', () => {
  assert.equal(select(graph, ['README.md', 'CONTRIBUTING.md', 'LICENSE']).scope, 'none');
  assert.equal(
    select(graph, ['site/astro.config.mjs', 'site/scripts/assemble.mjs', 'site/package.json']).scope,
    'none',
  );
  assert.equal(select(graph, []).scope, 'none');
});

test('a package whose adapter specs need a server starts the integration job, the brokers among them', () => {
  const integration = (changed) =>
    asOutputs(select(graph, changed))
      .split('\n')
      .find((line) => line.startsWith('integration='));

  for (const broker of ['nats', 'rabbitmq', 'kafka']) {
    assert.equal(integration([`packages/${broker}/src/index.ts`]), 'integration=true');
  }

  assert.equal(integration(['packages/pino/src/index.ts']), 'integration=false');
  assert.equal(integration(['README.md']), 'integration=false');
});
