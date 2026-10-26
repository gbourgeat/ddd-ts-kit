import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { asOutputs, commandOf, dependentsOf, readGraph, select, stacksOf } from './affected-packages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const graph = readGraph(ROOT);
const names = Object.keys(graph);

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

/** The oracle, written the other way round: a package depends on another when walking its dependencies reaches it. */
function dependsOn(name, target, seen = []) {
  return graph[name].some(
    (dependency) =>
      dependency === target || (!seen.includes(dependency) && dependsOn(dependency, target, [...seen, name])),
  );
}

test('a leaf is selected alone, the kernel selects every package that is built on it', () => {
  assert.deepEqual(select(graph, ['packages/winston/src/index.ts']), {
    scope: 'packages',
    reason: 'the changed packages and the packages that depend on them',
    packages: ['winston'],
    integrated: true,
    stacks: 'cover',
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

test('a change of documents alone leaves out the runs that integrate every package, but for what they read', () => {
  assert.equal(
    select(graph, ['docs/concepts/testing-strategy.md', 'plugin/skills/testing/SKILL.md']).integrated,
    false,
  );
  assert.equal(select(graph, ['packages/knex/README.md', 'site/astro.config.mjs', 'changes/a.md']).integrated, false);
  assert.equal(select(graph, ['README.md']).integrated, true);
  assert.equal(select(graph, ['docs/ARCHITECTURE.md']).integrated, true);
  assert.equal(select(graph, ['packages/cli/templates/init/CLAUDE.md.tpl']).integrated, true);
  assert.equal(select(graph, ['examples/scheduling/docs/architecture/contexts.md']).integrated, true);
  assert.equal(select(graph, ['docs/guides/commands.md', 'packages/pino/src/index.ts']).integrated, true);
  assert.equal(select(graph, ['package.json']).integrated, true);
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

test('a script runs on the packages reached as path filters, on everything without a filter, and never on documents alone', () => {
  const partial = commandOf(select(graph, ['packages/pino/src/index.ts']), 'test');

  assert.deepEqual(partial.args, ['run', 'test', '--', 'packages/pino/']);
  assert.deepEqual(partial.env, { KIT_AFFECTED: 'pino' });

  const whole = commandOf(select(graph, ['package.json']), 'test');

  assert.deepEqual(whole.args, ['run', 'test', '--']);
  assert.deepEqual(whole.env, { KIT_AFFECTED: '' });

  assert.equal(select(graph, ['README.md']).scope, 'none');
});

test('a pull request that changes anything a project runs or is built from generates a cover of the stacks', () => {
  for (const file of [
    'packages/cli/templates/init/CLAUDE.md.tpl',
    'packages/pino/templates/pino.ts.tpl',
    'packages/cli/src/generate/aggregate.ts',
    'packages/cli/test/e2e/stacks.ts',
    'packages/kernel/package.json',
    'packages/kernel/src/aggregate.ts',
    'packages/knex/src/index.ts',
    'packages/eslint-plugin/src/index.ts',
    'packages/kernel/test/aggregate.spec.ts',
    'pipeline/monorepo/e2e-shards.mjs',
    'pipeline/depcruise-config.mjs',
    'package-lock.json',
    'tsconfig.json',
    'vitest.config.ts',
    'eslint.config.mjs',
    '.github/workflows/ci.yml',
    'package.json',
  ]) {
    assert.equal(stacksOf([file]), 'cover', file);
    assert.equal(select(graph, [file]).stacks, 'cover', file);
  }
});

test('a pull request that changes nothing a project runs generates no stack', () => {
  for (const file of [
    'packages/kernel/README.md',
    'pipeline/README.md',
    'plugin/skills/testing/SKILL.md',
    'examples/scheduling/src/main.ts',
    '.github/ISSUE_TEMPLATE/bug.yml',
    'docs/guides/commands.md',
    'README.md',
    'changes/a.md',
    'site/astro.config.mjs',
  ]) {
    assert.equal(stacksOf([file]), 'none', file);
  }

  assert.equal(stacksOf(['README.md', 'packages/cli/src/run.ts']), 'cover');
  assert.equal(stacksOf([]), 'none');
});

test('the trunk, the night and a release, which name no base, generate every stack', () => {
  const lines = asOutputs({ scope: 'all', packages: names, integrated: true, stacks: 'all' }).split('\n');

  assert.ok(lines.includes('stacks=all'));
  assert.ok(
    asOutputs(select(graph, ['README.md']))
      .split('\n')
      .includes('stacks=none'),
  );
});

test('run as the install job runs it, the script answers the stacks of the run', () => {
  const run = (...args) =>
    spawnSync(
      process.execPath,
      [path.join(ROOT, 'pipeline/monorepo/affected-packages.mjs'), ...args, '--format', 'github'],
      {
        encoding: 'utf8',
      },
    );

  // The trunk and the night name no base: every stack. A base that is HEAD itself changes nothing: none.
  assert.match(run('--base', '').stdout, /^stacks=all$/m);
  assert.match(run('--base', 'HEAD').stdout, /^stacks=none$/m);
});
