import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, 'guard.mjs');
const cli = join(here, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

// Everything these tests write lives under one directory, removed when they end, passed or failed:
// the projects, and the temporary directory the guard is given for its commit reminder markers.
const workspace = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-guard-'));
const guardTemp = join(workspace, 'tmp');

mkdirSync(guardTemp);
after(() => rmSync(workspace, { recursive: true, force: true }));

function directory(label) {
  return mkdtempSync(join(workspace, `${label}-`));
}

function project(config = {}) {
  const root = directory('project');
  const init = spawnSync('node', [cli, 'init', '--orm', 'none', '--context', 'ordering:core'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(init.status, 0, init.stderr);
  if (Object.keys(config).length > 0) {
    patchConfig(root, config);
  }
  mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
  // A launcher like the one npm writes: the compiled entry file itself is not executable.
  writeFileSync(join(root, 'node_modules', '.bin', 'ddd-ts-kit'), `#!/bin/sh\nexec node "${cli}" "$@"\n`, {
    mode: 0o755,
  });
  return root;
}

function patchConfig(root, patch) {
  const path = join(root, 'ddd-ts-kit.config.json');
  const current = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...current, ...patch }));
}

function run(mode, input, env = {}) {
  const result = spawnSync('node', [guard, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: guardTemp, ...env },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    output: result.stdout ? JSON.parse(result.stdout) : undefined,
  };
}

function put(root, path, content = '') {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

function git(root, ...args) {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=guard', '-c', 'user.email=guard@example.test', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
}

function committed(config = {}) {
  const root = project(config);
  writeFileSync(join(root, '.gitignore'), 'node_modules\n');
  git(root, 'init', '--quiet');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'chore: bootstrap');
  return root;
}

function worker(root, context = 'ordering') {
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context }));
  return { agent_type: 'ddd-ts-kit:context-builder' };
}

const reason = (result) => result.output.hookSpecificOutput.permissionDecisionReason;
const decision = (result) => result.output?.hookSpecificOutput.permissionDecision;
const bash = (root, command, extra = {}) => ({ cwd: root, tool_name: 'Bash', tool_input: { command }, ...extra });
const write = (file, extra = {}) => ({ tool_name: 'Write', tool_input: { file_path: file, content: '' }, ...extra });

test('session start hands the workflow and the context map over as additional context', () => {
  const root = project();
  const { output } = run('session', { cwd: root });
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /ordering \[core\]/);
});

test('outside a ddd-ts-kit project every mode stays silent', () => {
  const elsewhere = directory('none');
  for (const mode of ['session', 'pre-write', 'post-write', 'stop']) {
    const result = run(mode, { cwd: elsewhere, ...write(join(elsewhere, 'a.aggregate.ts')) });
    assert.equal(result.status, 0);
    assert.equal(result.output, undefined);
  }
});

test('a new file of a generated role is refused with the generator command', () => {
  const root = project();
  const { output } = run('pre-write', write(join(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /generate aggregate/);
});

test('in advise mode the same write asks instead of refusing', () => {
  const root = project({ guard: 'advise' });
  const { output } = run('pre-write', write(join(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'ask');
});

test('editing an existing role file and creating an ordinary file are allowed', () => {
  const root = project();
  const existing = join(root, 'src/contexts/ordering/ordering.module.ts');
  assert.equal(run('pre-write', write(existing)).output, undefined);
  assert.equal(
    run('pre-write', write(join(root, 'src/contexts/ordering/infrastructure/persistence/order.mapper.ts'))).output,
    undefined,
  );
});

test('a generated contract is never edited by hand', () => {
  const root = project();
  const { output } = run('pre-write', write(join(root, 'openapi/openapi.json')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /docs:generate/);
});

test('the test writer agent cannot touch production code', () => {
  const root = project();
  const agent = { agent_type: 'ddd-ts-kit:domain-test-writer' };
  const production = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.module.ts'), agent));
  assert.equal(production.output.hookSpecificOutput.permissionDecision, 'deny');
  const spec = run('pre-write', write(join(root, 'src/contexts/ordering/test/unit/order.spec.ts'), agent));
  assert.equal(spec.output, undefined);
});

test('a written file that breaks a rule is reported to the model with the fix', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { now() { return express; } }\n");
  const result = run('post-write', write(file));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /layer\/domain-purity/);
  assert.match(result.stderr, /do instead/);
});

test('stop is blocked while errors remain, and never twice in a row', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "import express from 'express';\nexport class Pricing { now() { return express; } }\n");
  assert.equal(run('stop', { cwd: root }).output.decision, 'block');
  assert.equal(run('stop', { cwd: root, stop_hook_active: true }).output, undefined);
});

test('a new suppression is put to the project owner, an untouched one is not', () => {
  const root = project();
  const file = join(root, 'src/contexts/ordering/ordering.module.ts');
  const adding = run('pre-write', {
    tool_name: 'Edit',
    tool_input: {
      file_path: file,
      old_string: 'const a = 1;',
      new_string: '// eslint-disable-next-line no-console\nconst a = 1;',
    },
  });
  assert.equal(adding.output.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(adding.output.hookSpecificOutput.permissionDecisionReason, /docs\/adr/);
  const keeping = run('pre-write', {
    tool_name: 'Edit',
    tool_input: {
      file_path: file,
      old_string: '// eslint-disable-next-line x -- y\nconst a = 1;',
      new_string: '// eslint-disable-next-line x -- y\nconst a = 2;',
    },
  });
  assert.equal(keeping.output, undefined);
});

test('skipping a test and relaxing the rules both need the owner', () => {
  const root = project();
  const spec = run('pre-write', write(join(root, 'src/contexts/ordering/test/unit/order.spec.ts'), {}));
  assert.equal(spec.output, undefined);
  const skipped = run('pre-write', {
    tool_name: 'Write',
    tool_input: {
      file_path: join(root, 'src/contexts/ordering/test/unit/order.spec.ts'),
      content: "it.skip('pays', () => {});",
    },
  });
  assert.equal(skipped.output.hookSpecificOutput.permissionDecision, 'ask');
  const config = run('pre-write', write(join(root, 'ddd-ts-kit.config.json')));
  assert.equal(config.output.hookSpecificOutput.permissionDecision, 'ask');
  const pipeline = run('pre-write', write(join(root, '.github/workflows/ci.yml')));
  assert.equal(pipeline.output.hookSpecificOutput.permissionDecision, 'ask');
});

test('malformed input never blocks', () => {
  const result = spawnSync('node', [guard, 'pre-write'], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('session start stays short: one line per context, far below the host limit', () => {
  const root = project();
  const context = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(context, /^ordering \[core\] upstreams: none; glossary: 0 terms; 0 aggregates/m);
  assert.ok(context.length < 2000, `${context.length} characters`);
  assert.doesNotMatch(context, /Plan:/);
});

test('session start points to the plan and its next step, so a session resumes cheaply', () => {
  const root = project();
  put(root, 'docs/architecture/plan.md', '# Architecture plan\n\nNext: 6 plan-slices - order the slices of billing\n');
  const context = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(context, /Plan: docs\/architecture\/plan\.md .*Next: 6 plan-slices - order the slices of billing/);
});

test('before the bootstrap, a plan alone is enough to resume', () => {
  const root = directory('plan');
  put(root, 'docs/architecture/plan.md', 'Next: 2 bounded-contexts\n');
  const { output } = run('session', { cwd: root });
  assert.match(output.hookSpecificOutput.additionalContext, /Next: 2 bounded-contexts/);
  assert.equal(run('stop', { cwd: root }).output, undefined);
});

test('the generated barrel and the generated import graph rules are never edited by hand', () => {
  const root = project();
  const barrel = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.declarations.ts')));
  assert.equal(decision(barrel), 'deny');
  assert.match(reason(barrel), /ddd-ts-kit docs/);
  const graph = run('pre-write', write(join(root, '.dependency-cruiser.cjs')));
  assert.equal(decision(graph), 'deny');
  assert.match(reason(graph), /depcruise-config --write/);
});

test('every generated role of the canonical tree names its generator', () => {
  const root = project();
  const roles = {
    'application/scheduling/expire-orders.job.ts': /generate job /,
    'application/authorization/only-buyer-cancels.policy.ts': /generate policy /,
    'application/integration/handlers/billing-invoice-issued.integration-handler.ts': /generate integration-handler /,
    'application/integration/publishers/order-placed.publisher.ts': /generate integration-event /,
    'published-language/order-placed.v1.integration-event.ts': /generate integration-event /,
    'application/event-handlers/order-placed.event-handler.ts': /generate event-handler /,
    'application/commands/place-order/place-order.handler.ts': /generate command\|query /,
    'domain/repositories/order.repository.ts': /generate repository /,
    'domain/services/pricing.service.ts': /generate domain-service /,
    'infrastructure/external/order-summary.gateway.ts': /generate gateway /,
    'infrastructure/external/remote-payment-gateway.adapter.ts': /generate adapter /,
    'infrastructure/anti-corruption/billing.translator.ts': /generate acl /,
  };
  for (const [path, generator] of Object.entries(roles)) {
    const result = run('pre-write', write(join(root, 'src/contexts/ordering', path)));
    assert.equal(decision(result), 'deny', path);
    assert.match(reason(result), generator, path);
  }
  const e2e = run('pre-write', write(join(root, 'test/e2e/place-order.e2e.spec.ts')));
  assert.match(reason(e2e), /generate e2e /);
});

test('a file of tokens is refused: a port is an abstract class', () => {
  const root = project();
  const result = run('pre-write', write(join(root, 'src/contexts/ordering/application/ports/ordering.ports.ts')));
  assert.equal(decision(result), 'deny');
  assert.match(reason(result), /abstract class/);
});

test('a hand-written adapter of persistence and a mapper stay free', () => {
  const root = project();
  for (const path of [
    'infrastructure/persistence/drizzle-order-reader.repository.ts',
    'infrastructure/persistence/order.mapper.ts',
    'presentation/http/place-order.dto.ts',
  ]) {
    assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering', path))).output, undefined, path);
  }
});

test('the test setup, the compiler options and the rule files need the owner', () => {
  const root = project();
  for (const path of [
    'vitest.config.ts',
    'tsconfig.json',
    'biome.json',
    'commitlint.config.mjs',
    '.claude/rules/domain.md',
  ]) {
    assert.equal(decision(run('pre-write', write(join(root, path)))), 'ask', path);
  }
});

test('a context worker writes inside its bounded context and its end-to-end specs only', () => {
  const root = project();
  const agent = worker(root);
  put(root, 'test/e2e/place-order.e2e.spec.ts');
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent)).output, undefined);
  assert.equal(
    run('pre-write', write(join(root, 'src/contexts/ordering/infrastructure/persistence/order.mapper.ts'), agent))
      .output,
    undefined,
  );
  assert.equal(run('pre-write', write(join(root, 'test/e2e/place-order.e2e.spec.ts'), agent)).output, undefined);
  const neighbour = run('pre-write', write(join(root, 'src/contexts/billing/CONTEXT.md'), agent));
  assert.equal(decision(neighbour), 'deny');
  assert.match(reason(neighbour), /another bounded context/);
  assert.match(reason(neighbour), /report the need to the conductor/);
});

test('a context worker never writes a shared file', () => {
  const root = project();
  const agent = worker(root);
  for (const path of [
    'ddd-ts-kit.config.json',
    'src/main.ts',
    'src/platform/compose-application.ts',
    'package.json',
    'package-lock.json',
    'docs/context-map.md',
    'docs/architecture/plan.md',
    'migrations/0002_orders.js',
    'test/e2e/support/start-application.ts',
    '.ddd-ts-kit/worker.json',
  ]) {
    const result = run('pre-write', write(join(root, path), agent));
    assert.equal(decision(result), 'deny', path);
    assert.match(reason(result), /shared file .* conductor/, path);
  }
  const barrel = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.declarations.ts'), agent));
  assert.equal(decision(barrel), 'deny');
});

test('the worker scope comes from the scope file or the environment, and binds the worker agent only', () => {
  const root = project();
  const shared = join(root, 'src/platform/compose-application.ts');
  const agent = { agent_type: 'ddd-ts-kit:context-builder' };
  assert.equal(run('pre-write', write(shared, agent)).output, undefined);
  assert.equal(decision(run('pre-write', write(shared, agent), { DDD_TS_KIT_WORKER_CONTEXT: 'billing' })), 'deny');
  worker(root);
  assert.equal(run('pre-write', write(shared)).output, undefined);
  assert.equal(run('pre-write', write(shared, { agent_type: 'ddd-ts-kit:architecture-reviewer' })).output, undefined);
  put(root, '.ddd-ts-kit/worker.json', 'not json');
  assert.equal(run('pre-write', write(shared, agent)).output, undefined);
});

test('in advise mode the worker scope asks, and off silences it', () => {
  const advised = project({ guard: 'advise' });
  assert.equal(decision(run('pre-write', write(join(advised, 'src/main.ts'), worker(advised)))), 'ask');
  const silent = project({ guard: 'off' });
  assert.equal(run('pre-write', write(join(silent, 'src/main.ts'), worker(silent))).output, undefined);
});

test('a context worker does not run a generator that writes shared files or another context', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit generate repository ordering Order --json',
    'npx ddd-ts-kit g integration-event ordering Order Placed',
    'npx ddd-ts-kit generate context shipping --classification core',
    'npx ddd-ts-kit@latest generate job ordering ExpireOrders --every 1h --command PlaceOrder',
  ]) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /conductor runs it on the trunk/, command);
  }
  const neighbour = run('pre-bash', bash(root, 'npx ddd-ts-kit generate value-object billing Money --json', agent));
  assert.match(reason(neighbour), /another context/);
  const implied = run(
    'pre-bash',
    bash(
      root,
      'npx ddd-ts-kit generate command ordering PlaceOrder --aggregate PurchaseOrder --permission order.place',
      agent,
    ),
  );
  assert.match(reason(implied), /repository of PurchaseOrder/);
});

test('a context worker generates freely inside its context, and reads anywhere', () => {
  const root = project();
  const agent = worker(root);
  put(root, 'src/contexts/ordering/domain/repositories/purchase-order.repository.ts');
  for (const command of [
    'npx ddd-ts-kit generate value-object ordering Money --json',
    'npx ddd-ts-kit generate command ordering PlaceOrder --aggregate PurchaseOrder --permission order.place',
    'npx ddd-ts-kit list --json',
    'npx ddd-ts-kit check --changed-since main',
    'npm install',
    'npm ci',
    'npm test -- ordering',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('a context worker does not change the dependencies', () => {
  const root = project();
  const result = run('pre-bash', bash(root, 'npm install dayjs', worker(root)));
  assert.equal(decision(result), 'deny');
  assert.match(reason(result), /lockfile/);
});

test('the worktree of a worker is found in its command, and other agents run anything', () => {
  const root = project();
  const agent = worker(root);
  const elsewhere = directory('session');
  const command = 'npx ddd-ts-kit generate repository ordering Order';
  assert.equal(decision(run('pre-bash', bash(elsewhere, `cd ${root} && ${command}`, agent))), 'deny');
  assert.equal(decision(run('pre-bash', bash(elsewhere, `${command} --cwd ${root}`, agent))), 'deny');
  assert.equal(run('pre-bash', bash(elsewhere, command, agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, command)).output, undefined);
  assert.equal(run('pre-bash', { cwd: root, tool_name: 'Bash', tool_input: {}, ...agent }).output, undefined);
});

test('at stop, a tree above the commit limits is reminded once, by slice, and never blocks', () => {
  const root = committed({ commit: { maxFiles: 3, maxLines: 1000 } });
  const session = { cwd: root, session_id: `s-${root}` };
  assert.equal(run('stop', session).output, undefined);
  for (const file of [
    'application/commands/place-order/place-order.notes.md',
    'presentation/http/place-order.route.ts',
    'test/unit/place-order.handler.spec.ts',
    'domain/value-objects/money.notes.md',
  ]) {
    put(root, join('src/contexts/ordering', file), 'one\ntwo\n');
  }
  put(root, 'src/platform/extra.md', 'one\n');
  const first = run('stop', session);
  assert.equal(first.status, 0);
  assert.equal(first.output.decision, undefined);
  assert.match(
    first.output.systemMessage,
    /5 changed files and 9 changed lines are uncommitted \(advised at most 3 files and 1000 lines/,
  );
  assert.match(first.output.systemMessage, /ordering: place-order \(3 files\), /);
  assert.match(first.output.systemMessage, /ordering: domain \(1 files\)/);
  assert.match(first.output.systemMessage, /platform \(1 files\)/);
  assert.match(first.output.systemMessage, /commit-discipline/);
  assert.equal(run('stop', session).output, undefined);
  assert.match(run('stop', { ...session, session_id: 'another' }).output.systemMessage, /uncommitted/);
});

test('the reminder comes back after a commit when the tree grows again', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  const session = { cwd: root, session_id: `again-${root}` };
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  assert.match(run('stop', session).output.systemMessage, /docs \(2 files\)/);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'docs: notes');
  assert.equal(run('stop', session).output, undefined);
  put(root, 'docs/c.md', 'c\n');
  put(root, 'docs/d.md', 'd\n');
  assert.match(run('stop', session).output.systemMessage, /2 changed files/);
});

test('changed lines count against their own limit, deletions and edits included', () => {
  const root = committed({ commit: { maxFiles: 50, maxLines: 5 } });
  writeFileSync(join(root, 'README.md'), 'one\ntwo\nthree\nfour\nfive\nsix\n');
  const { output } = run('stop', { cwd: root, session_id: `lines-${root}` });
  assert.match(output.systemMessage, /1 changed files and \d+ changed lines/);
  assert.match(output.systemMessage, /project root \(1 files\)/);
});

test('generated files are not counted in the size of a commit', () => {
  // Advise mode: the stale barrel written below must not turn this stop into an architecture block.
  const root = committed({ guard: 'advise', commit: { maxFiles: 1, maxLines: 1000 } });
  put(root, 'docs/a.md', 'a\n');
  for (const path of [
    'src/contexts/ordering/ordering.declarations.ts',
    'openapi/openapi.json',
    'docs/integration/asyncapi.json',
    'docs/context-map.md',
    'package-lock.json',
    '.dependency-cruiser.cjs',
    '.ddd-ts-kit/worker.json',
  ]) {
    put(root, path, 'changed\n'.repeat(50));
  }
  assert.equal(run('stop', { cwd: root, session_id: `generated-${root}` }).output, undefined);
  put(root, 'docs/b.md', 'b\n');
  assert.match(
    run('stop', { cwd: root, session_id: `generated-${root}` }).output.systemMessage,
    /2 changed files and 2 changed lines/,
  );
});

test('the default commit limits apply when the config says nothing', () => {
  const root = committed({});
  for (let index = 0; index < 20; index += 1) {
    put(root, `docs/note-${index}.md`, 'a\n');
  }
  assert.equal(run('stop', { cwd: root, session_id: `defaults-${root}` }).output, undefined);
  put(root, 'docs/note-20.md', 'a\n');
  assert.match(
    run('stop', { cwd: root, session_id: `defaults-${root}` }).output.systemMessage,
    /at most 20 files and 600 lines/,
  );
});

test('nonsense commit limits are an error of the configuration, reported as such', () => {
  const root = committed({ commit: { maxFiles: 'many', maxLines: -1 } });

  put(root, 'docs/note.md', 'a\n');

  assert.match(run('stop', { cwd: root, session_id: `nonsense-${root}` }).output.reason, /commit\.maxFiles/);
});

test('session start repeats the commit reminder, and stop then stays quiet', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1000 } });
  const session = { cwd: root, session_id: `start-${root}` };
  put(root, 'docs/a.md', 'a\n');
  put(root, 'docs/b.md', 'b\n');
  assert.match(run('session', session).output.hookSpecificOutput.additionalContext, /2 changed files .* uncommitted/);
  assert.equal(run('stop', session).output, undefined);
  assert.match(run('session', session).output.hookSpecificOutput.additionalContext, /uncommitted/);
});

test('architecture errors block the stop before any word about commits', () => {
  const root = committed({ commit: { maxFiles: 1, maxLines: 1 } });
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  put(root, 'docs/a.md', 'a\n');
  const { output } = run('stop', { cwd: root, session_id: `errors-${root}` });
  assert.equal(output.decision, 'block');
  assert.equal(output.systemMessage, undefined);
});

test('with the guard off, and outside a git repository, nothing is said about commits', () => {
  const silent = committed({ guard: 'off', commit: { maxFiles: 1, maxLines: 1 } });
  put(silent, 'docs/a.md', 'a\n');
  put(silent, 'docs/b.md', 'b\n');
  assert.equal(run('stop', { cwd: silent, session_id: 'off' }).output, undefined);
  const untracked = project({ commit: { maxFiles: 1, maxLines: 1 } });
  put(untracked, 'docs/a.md', 'a\n');
  assert.equal(run('stop', { cwd: untracked, session_id: 'no-git' }).output, undefined);
});
