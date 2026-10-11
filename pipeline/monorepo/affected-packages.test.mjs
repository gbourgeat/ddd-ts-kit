import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dependentsOf, readGraph, select } from './affected-packages.mjs';

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

  assert.deepEqual(
    select(graph, ['packages/kernel/src/index.ts']).packages,
    names.filter((name) => name !== 'eslint-plugin'),
  );
});

test('what the specs of the CLI read outside their package selects the CLI', () => {
  for (const file of [
    'docs/ARCHITECTURE.md',
    'pipeline/lefthook.yml',
    'examples/scheduling/package.json',
    'plugin/skills/start/SKILL.md',
    'biome.json',
  ]) {
    assert.deepEqual(select(graph, [file]).packages, ['cli'], file);
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

test('documents no spec reads select nothing', () => {
  assert.equal(select(graph, ['README.md', 'CONTRIBUTING.md', 'LICENSE']).scope, 'none');
  assert.equal(select(graph, []).scope, 'none');
});
