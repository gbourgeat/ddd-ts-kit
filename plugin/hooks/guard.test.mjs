import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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

function project(config = {}, flags = []) {
  const root = directory('project');
  const init = spawnSync('node', [cli, 'init', '--orm', 'none', '--context', 'ordering:core', ...flags], {
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

test('session start says when the installed packages are not the version the skills describe', () => {
  // The guard states the version of the CLI: `release-version.mjs` checks that they agree.
  const described = JSON.parse(readFileSync(join(here, '..', '..', 'packages', 'cli', 'package.json'), 'utf8')).version;
  const [major, minor, patch] = described.split('.').map(Number);
  const breaking = (step) => (major === 0 ? `0.${minor + step}.0` : `${major + step}.0.0`);
  const briefing = (installed) => {
    const root = project();
    if (installed !== undefined) {
      put(root, 'node_modules/ddd-ts-kit/package.json', JSON.stringify({ name: 'ddd-ts-kit', version: installed }));
    }
    return run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  };

  assert.doesNotMatch(briefing(undefined), /Version gap/);
  assert.doesNotMatch(briefing(`${major}.${minor}.${patch + 1}`), /Version gap/);
  assert.match(briefing(breaking(1)), /Version gap: .* update the plugin/);
  assert.match(briefing(`${breaking(-1)}-rc.1`), /Version gap: .* node_modules\/ddd-ts-kit\/CHANGELOG\.md/);
  assert.match(briefing(breaking(-1)), /npx ddd-ts-kit doctor/);
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

test('a generated contract is never edited by hand, in YAML, in JSON or split into documents', () => {
  const root = project();
  for (const file of [
    'openapi/openapi.yaml',
    'openapi/openapi.json',
    'openapi/back-office.yaml',
    'docs/integration/asyncapi.yaml',
    'src/platform/http/openapi-documents.ts',
  ]) {
    const { output } = run('pre-write', write(join(root, file)));
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny', file);
    assert.match(output.hookSpecificOutput.permissionDecisionReason, /docs:generate/);
  }
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

const patch = (root, ...sections) => ({
  cwd: root,
  turn_id: 'turn-1',
  tool_name: 'apply_patch',
  tool_input: { command: ['*** Begin Patch', ...sections, '*** End Patch'].join('\n') },
});

test('Codex: a patch that adds a file of a generated role is refused with the generator command', () => {
  const root = project();
  const result = run(
    'pre-write',
    patch(
      root,
      '*** Add File: src/contexts/ordering/infrastructure/persistence/order.mapper.ts',
      '+export class OrderMapper {}',
      '*** Add File: src/contexts/ordering/domain/aggregates/order.aggregate.ts',
      '+export class Order {}',
    ),
  );
  assert.equal(decision(result), 'deny');
  assert.match(reason(result), /order\.aggregate\.ts is a new file of a generated role.*generate aggregate/);
});

test('Codex: what Claude Code asks the owner is said to the user, never a question Codex cannot put', () => {
  const root = project();
  const result = run(
    'pre-write',
    patch(
      root,
      '*** Update File: src/contexts/ordering/ordering.module.ts',
      '@@',
      '-const a = 1;',
      '+// eslint-disable-next-line no-console',
      '+const a = 1;',
    ),
  );
  assert.equal(result.output.hookSpecificOutput, undefined);
  assert.match(result.output.systemMessage, /a lint suppression/);
  const removing = run(
    'pre-write',
    patch(
      root,
      '*** Update File: src/contexts/ordering/ordering.module.ts',
      '-// eslint-disable-line',
      '+const b = 2;',
    ),
  );
  assert.equal(removing.output, undefined);
  assert.equal(
    run('pre-write', patch(root, '*** Delete File: src/contexts/ordering/domain/aggregates/order.aggregate.ts')).output,
    undefined,
  );
});

test('Codex: a patched file that breaks a rule blocks the result of the tool with the fix', () => {
  const root = project();
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  const result = run(
    'post-write',
    patch(root, '*** Update File: src/contexts/ordering/domain/services/pricing.service.ts', '+import express'),
  );
  assert.equal(result.status, 0);
  assert.equal(result.output.decision, 'block');
  assert.match(result.output.reason, /layer\/domain-purity[\s\S]*do instead/);
});

test('Copilot: its own hook format is read, a relative path included, and answered in it', () => {
  const root = project();
  const result = run('pre-write', {
    cwd: root,
    sessionId: 'session-1',
    toolName: 'create',
    toolArgs: JSON.stringify({
      path: 'src/contexts/ordering/domain/aggregates/order.aggregate.ts',
      file_text: 'export class Order {}',
    }),
  });
  assert.equal(result.output.permissionDecision, 'deny');
  assert.match(result.output.permissionDecisionReason, /generate aggregate/);
  const skipped = run('pre-write', {
    tool_name: 'Edit',
    tool_input: {
      path: join(root, 'src/contexts/ordering/test/unit/order.spec.ts'),
      old_str: "it('pays', () => {});",
      new_str: "it.skip('pays', () => {});",
    },
  });
  assert.equal(decision(skipped), 'ask');
});

test('a host that does not say the stop was refused is refused once for the same errors', () => {
  const root = project();
  put(
    root,
    'src/contexts/ordering/domain/services/pricing.service.ts',
    "import express from 'express';\nexport class Pricing { now() { return express; } }\n",
  );
  const stopping = { cwd: root, sessionId: `session-${Date.now()}` };
  assert.equal(run('stop', stopping).output.decision, 'block');
  assert.equal(run('stop', stopping).output, undefined);
  assert.equal(run('stop', { ...stopping, stop_hook_active: false }).output.decision, 'block');
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
  // A journey crosses use cases and contexts: no generator writes it.
  assert.equal(run('pre-write', write(join(root, 'test/e2e/journey-tenancy.e2e.spec.ts'))).output, undefined);
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
    '.github/instructions/domain.instructions.md',
    '.github/copilot/settings.json',
    '.github/hooks/guard.json',
    '.codex/config.toml',
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
  assert.equal(run('pre-write', write(join(root, '.ddd-ts-kit/report.md'), agent)).output, undefined);
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

const ACCEPTANCE = 'test/acceptance/us5.acceptance.spec.ts';
const SCENARIO = `it('#US5.02 AC1 a customer places an order', pending(async () => {
  expectStatus(await client.post('/orders', {}), 201);
}));
`;
const edit = (file, { from, to }, extra = {}) => ({
  tool_name: 'Edit',
  tool_input: { file_path: file, old_string: from, new_string: to },
  ...extra,
});

test('a sub-agent only removes pending(...) from an acceptance scenario, by edit or by rewrite', () => {
  const root = project();
  const agent = worker(root);
  const file = join(root, ACCEPTANCE);
  put(root, ACCEPTANCE, SCENARIO);
  const unwrapped = `it('#US5.02 AC1 a customer places an order', async () => {
  expectStatus(await client.post('/orders', {}), 201);
});
`;
  assert.equal(run('pre-write', edit(file, { from: SCENARIO, to: unwrapped }, agent)).output, undefined);
  assert.equal(
    run('pre-write', { tool_name: 'Write', tool_input: { file_path: file, content: unwrapped }, ...agent }).output,
    undefined,
  );
  for (const easier of [
    SCENARIO.replace('201', '404'),
    SCENARIO.replace('{}), 201', '{ lines: [] }), 201'),
    SCENARIO.replace('  expectStatus', '  // expectStatus'),
  ]) {
    const refused = run('pre-write', edit(file, { from: SCENARIO, to: easier }, agent));
    assert.equal(decision(refused), 'deny', easier);
    assert.match(reason(refused), /only removes `pending\(\.\.\.\)`/);
    assert.match(reason(refused), /the conductor changes the criterion or locks again with a reason/);
  }
  const testWriter = { agent_type: 'ddd-ts-kit:domain-test-writer' };
  assert.equal(
    decision(run('pre-write', edit(file, { from: SCENARIO, to: SCENARIO.replace('201', '200') }, testWriter))),
    'deny',
  );
  const created = run('pre-write', write(join(root, 'test/acceptance/us6.acceptance.spec.ts'), agent));
  assert.equal(decision(created), 'deny');
});

test('the conductor edits an acceptance scenario, which the lock then judges; a new spec comes from its generator', () => {
  const root = project();
  const file = join(root, ACCEPTANCE);
  put(root, ACCEPTANCE, SCENARIO);
  assert.equal(run('pre-write', edit(file, { from: SCENARIO, to: SCENARIO.replace('201', '200') })).output, undefined);
  const created = run('pre-write', write(join(root, 'test/acceptance/us6.acceptance.spec.ts')));
  assert.equal(decision(created), 'deny');
  assert.match(reason(created), /npx ddd-ts-kit generate acceptance <story> --json/);
});

test('the lock of an acceptance is written by the CLI only, and locking is refused to a sub-agent', () => {
  const root = project();
  const lock = run('pre-write', write(join(root, 'test/acceptance/us5.acceptance.lock.json')));
  assert.equal(decision(lock), 'deny');
  assert.match(reason(lock), /npx ddd-ts-kit acceptance <story> --lock` writes it/);
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit acceptance US5 --lock',
    'npx ddd-ts-kit acceptance US5 --lock --reason "the scenario expected 200"',
    'pnpm exec ddd-ts-kit acceptance US5 --lock',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit acceptance US5 --gate written', agent)).output, undefined);
  assert.equal(decision(run('pre-bash', bash(root, 'npx ddd-ts-kit generate acceptance US5', agent))), 'deny');
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

test('a context worker records a decision of its slices, and no deviation', () => {
  const root = committed();
  const agent = worker(root);
  const record = 'npx ddd-ts-kit generate adr "Rounding of late fees" --number 0402';
  assert.equal(run('pre-bash', bash(root, record, agent)).output, undefined);
  const deviation = run('pre-bash', bash(root, `${record} --deviation clean/file-size`, agent));
  assert.equal(decision(deviation), 'deny');
  assert.match(reason(deviation), /ddd-ts-kit\.config\.json/);
  put(root, 'docs/adr/0402-rounding-of-late-fees.md', '# ADR-0402: Rounding of late fees\n');
  const own = join(root, 'docs/adr/0402-rounding-of-late-fees.md');
  assert.equal(run('pre-write', write(own, agent)).output, undefined);
  put(root, 'docs/adr/0001-record-architecture-decisions.md', '# ADR-0001\n');
  git(root, 'add', 'docs/adr/0001-record-architecture-decisions.md');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'docs: a record of the trunk');
  const trunk = run('pre-write', write(join(root, 'docs/adr/0001-record-architecture-decisions.md'), agent));
  assert.equal(decision(trunk), 'deny');
  assert.equal(decision(run('pre-write', write(join(root, 'docs/adr/notes/draft.md'), agent))), 'deny');
});

test('a context worker writes its working migration, and no other migration', () => {
  const root = project();
  const agent = worker(root);
  for (const path of [
    'migrations/20261015101500_working-add-orders.sql',
    'migrations/20261015101500_working-add-orders.ts',
    'migrations/1791829645467-working-add-orders.ts',
    'prisma/migrations/20261015101500_working_add_orders/migration.sql',
    'db/migrations/20261015101500_working-add-orders.sql',
  ]) {
    assert.equal(run('pre-write', write(join(root, path), agent)).output, undefined, path);
  }
  for (const path of [
    'migrations/20261015101500_add-orders.sql',
    'migrations/meta/_journal.json',
    'src/platform/migrations/20261015101500_working-add-orders.ts',
    'src/contexts/billing/migrations/20261015101500_working-add-orders.ts',
  ]) {
    assert.equal(decision(run('pre-write', write(join(root, path), agent))), 'deny', path);
  }
});

test('a context worker generates a working migration only', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npm run db:generate working-add-orders',
    'npm run db:generate -- working_add_orders',
    'npm run db:generate migrations/working-add-orders',
    'npm run db:migrate',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  const real = run('pre-bash', bash(root, 'npm run db:generate add-orders', agent));
  assert.equal(decision(real), 'deny');
  assert.match(reason(real), /db:generate working-add-orders/);
  assert.equal(run('pre-bash', bash(root, 'npm run db:generate add-orders')).output, undefined);
});

test('a sub-agent reads a briefing of worker-scope, and only the conductor prepares a worktree', () => {
  const root = project();
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  const preparing = run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --rows 3', reviewer));
  assert.equal(decision(preparing), 'deny');
  assert.match(reason(preparing), /--dry-run/);
  const reading = 'npx ddd-ts-kit worker-scope ordering --rows 3 --dry-run --json';
  assert.equal(run('pre-bash', bash(root, reading, reviewer)).output, undefined);
  assert.equal(
    run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --resume', reviewer)).output,
    undefined,
  );
  assert.equal(
    run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --base origin/main')).output,
    undefined,
  );
});

test('worker-scope is refused to a sub-agent however the CLI is launched', () => {
  const root = project();
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  for (const command of [
    'node packages/cli/dist/bin.js worker-scope ordering',
    'node node_modules/ddd-ts-kit/dist/bin.js worker-scope ordering --rows 3',
    'node scripts/kit.mjs worker-scope ordering',
    'npm exec ddd-ts-kit -- worker-scope ordering',
    'pnpm exec ddd-ts-kit worker-scope ordering',
    'node_modules/.bin/ddd-ts-kit worker-scope ordering',
    'bunx ddd-ts-kit@latest worker-scope ordering',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, reviewer))), 'deny', command);
  }
  for (const command of [
    'node packages/cli/dist/bin.js worker-scope ordering --dry-run',
    'grep -rn worker-scope docs',
    'git log --grep worker-scope',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, reviewer)).output, undefined, command);
  }
});

test('a generator of shared files is refused to a worker however the CLI is launched', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'node node_modules/ddd-ts-kit/dist/bin.js generate repository ordering Order',
    'node scripts/kit.mjs g context shipping',
    'npm exec ddd-ts-kit -- generate integration-event ordering Order Placed',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
  }
  assert.equal(
    run('pre-bash', bash(root, 'node scripts/kit.mjs generate value-object ordering Money', agent)).output,
    undefined,
  );
  assert.equal(run('pre-bash', bash(root, 'npm run docs:generate', agent)).output, undefined);
});

test('only the conductor lands a branch with merge-trunk --to-land; a worker brings the trunk in without it', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit merge-trunk --to-land',
    `npx ddd-ts-kit merge-trunk --to-land --cwd ${root}`,
    'node packages/cli/dist/bin.js merge-trunk --trunk origin/main --to-land',
    'node scripts/kit.mjs merge-trunk --to-land',
  ]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /Only the conductor lands a branch/);
  }
  for (const command of [
    'npx ddd-ts-kit merge-trunk',
    'npx ddd-ts-kit merge-trunk --continue',
    'npx ddd-ts-kit merge-trunk --abort',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit merge-trunk --to-land')).output, undefined);
});

// Each takes one side of a merge on the sources or the tests.
const ONE_SIDE = [
  'git merge -X theirs origin/main',
  'git merge --no-edit -Xours origin/main',
  'git merge --strategy-option=theirs main',
  'git merge -s ours origin/main',
  'git pull -X theirs origin main',
  'git checkout --theirs src/contexts/ordering/domain/order.aggregate.ts',
  'git checkout --ours -- src/contexts/ordering',
  'git restore --theirs test/e2e/place-order.e2e.spec.ts',
  'git checkout --theirs .',
];

// A plain merge, a squash, an unstaged path.
const NOT_ONE_SIDE = [
  'git merge origin/main',
  'git merge --no-ff --squash build/ordering',
  'git restore --staged src/contexts/ordering/domain/order.aggregate.ts',
];

test('a sub-agent never takes one side of a merge on the sources or the tests, and is pointed to merge-trunk', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [...ONE_SIDE, `cd ${root} && git checkout --theirs src`]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /resolve each hunk/);
    assert.match(reason(refused), /npx ddd-ts-kit merge-trunk --continue/);
  }
  for (const command of NOT_ONE_SIDE) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  assert.equal(decision(run('pre-bash', bash(root, 'git merge -X theirs main', reviewer))), 'deny');
  assert.equal(run('pre-bash', bash(root, 'git merge -X theirs main')).output, undefined);
});

const DEPENDENCY_CHANGES = [
  'npm install dayjs',
  'npm i zod',
  'npm i -D zod',
  'npm install --save-dev zod',
  'npm install -E -D zod',
  'npm i zod@1 --save-exact',
  'pnpm add -D zod',
  'yarn add --dev zod',
  'bun add zod',
  'npm uninstall dayjs',
  'pnpm update',
  'npm pkg set dependencies.zod=4',
  'cd src && npm i -D zod',
  'bash -c "npm i -D zod"',
];

test('a context worker does not change the dependencies, wherever the flags stand', () => {
  const root = project();
  const agent = worker(root);
  for (const command of DEPENDENCY_CHANGES) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /lockfile/, command);
  }
});

test('a context worker installs the lockfile freely', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npm ci',
    'npm install',
    'npm i',
    'npm install --omit dev',
    'pnpm install --frozen-lockfile',
    'yarn install --immutable',
    'git commit -m "build: npm i zod is for the conductor"',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

// The table of the Bash commands a worker runs: the kit's own commands pass, every way of writing
// a file of the project around the editor tools is refused.
const WORKER_COMMANDS_ALLOWED = [
  'npx ddd-ts-kit generate value-object invoicing Money --json',
  'npx ddd-ts-kit verify-slice invoicing --since main 2>&1 | tail -40',
  'npx ddd-ts-kit check --changed-since main > /dev/null',
  'npm run format',
  'npm run lint:fix',
  'npm run regenerate',
  'npm test -- invoicing 2>&1 | tail -20',
  'npm run verify &> /dev/null; echo $?',
  'npm test > "$TMPDIR/invoicing-tests.log" 2>&1',
  'ls src/contexts >&2',
  'git add src/contexts/invoicing && git status --porcelain',
  'git diff --stat main',
  'git log --oneline -5',
  "git commit -F - <<'EOF'\nfeat(invoicing): issue an invoice\n\nA total > 0 is checked; rm -rf src is a sentence here.\nEOF",
  'git commit -m "feat(invoicing): echo > file is a message"',
  'git checkout -b build/invoicing-2',
  'git checkout main',
  'git checkout -- src/contexts/invoicing/CONTEXT.md',
  'git restore src/contexts/invoicing/CONTEXT.md',
  'git restore --staged package.json',
  'git rm src/contexts/invoicing/domain/draft.ts',
  'git mv src/contexts/invoicing/a.ts src/contexts/invoicing/b.ts',
  'git clean -n',
  'git apply --check invoicing.patch',
  'cat src/contexts/invoicing/CONTEXT.md',
  'grep -rn Invoice src/contexts | head',
  'sed -n 1,20p src/platform/compose-application.ts',
  'echo "notes" > "$TMPDIR/notes.txt"',
  'rm src/contexts/invoicing/domain/draft.notes.md',
  'rm -f .ddd-ts-kit/report.md',
  'cp src/contexts/invoicing/domain/invoice.ts "$TMPDIR/invoice.ts"',
  'mv src/contexts/invoicing/a.ts src/contexts/invoicing/b.ts',
  'touch src/contexts/invoicing/domain/payment.notes.md',
  'find src/contexts/invoicing -name "*.orig" -delete',
  'node scripts/report.mjs',
  'node --version',
  'python3 -m json.tool package.json',
  'npx --no -- biome format src/contexts/invoicing',
  'npx @biomejs/biome format src/contexts/invoicing',
  'sed -i "s/a/b/" src/contexts/invoicing/CONTEXT.md',
  "sed -ne 's/a/b/p' -i src/contexts/invoicing/CONTEXT.md",
  'echo x >> src/contexts/invoicing/CONTEXT.md',
  "cat > src/contexts/invoicing/domain/notes.md <<'EOF'\nA note.\nEOF",
  'echo x | tee src/contexts/invoicing/domain/notes.md',
  'perl -pe \'s/a/b/\' src/main.ts > "$TMPDIR/main.ts"',
  "python3 -c \"open('src/contexts/invoicing/CONTEXT.md', 'a').write('')\"",
  "node - <<'EOF'\nconsole.log(1)\nEOF",
  'python3 <<EOF\nprint(1)\nEOF',
  'cat build.js | node',
];

const WORKER_COMMANDS_REFUSED = [
  ["sed -i.bak -e 's/a/b/' src/main.ts", /`sed -i` editing src\/main\.ts: You build the context/],
  ['perl -pi -e "s/a/b/" src/main.ts', /`perl -i` editing src\/main\.ts/],
  ["perl -i -pe 's/a/b/' package.json", /`perl -i` editing package\.json/],
  ['echo x > src/main.ts', /the redirection `> src\/main\.ts`/],
  ['npm test &> test-output.log', /redirection `&> test-output\.log`/],
  ["cat > src/platform/extra.ts <<'EOF'\nexport const a = 1;\nEOF", /redirection `> src\/platform\/extra\.ts`/],
  ['echo x > "$OUT"', /redirection `> \$OUT`/],
  ['echo x | tee src/main.ts', /`tee` writing src\/main\.ts/],
  ['echo x | tee -a docs/notes.md', /`tee` writing docs\/notes\.md/],
  ['cp "$TMPDIR/x.ts" src/platform/x.ts', /outside its scope: `cp` changes src\/platform\/x\.ts/],
  ['mv src/contexts/invoicing/a.ts src/platform/a.ts', /`mv` changes src\/platform\/a\.ts/],
  ['mv src/platform/a.ts src/contexts/invoicing/a.ts', /`mv` changes src\/platform\/a\.ts/],
  ['rm -rf src/contexts/catalog', /`rm` changes src\/contexts\/catalog/],
  ['rm package-lock.json', /`rm` changes package-lock\.json/],
  ['rm "$FILE"', /files only the shell knows/],
  ['touch src/platform/new.ts', /`touch`/],
  ['truncate -s 0 src/main.ts', /`truncate`/],
  ['dd if=/dev/zero of=src/main.ts count=1', /`dd` changes src\/main\.ts/],
  ['install -m 644 notes.txt src/platform/notes.txt', /`install`/],
  ['ln -sf ../x src/platform/link.ts', /`ln`/],
  ['git checkout -- src/main.ts', /`git checkout` changes src\/main\.ts/],
  ['git checkout main -- package.json', /`git checkout` changes package\.json/],
  ['git checkout .', /the whole project/],
  ['git restore src/main.ts', /`git restore`/],
  ['git -C src restore main.ts', /`git restore` changes src\/main\.ts/],
  ['git rm src/platform/compose-application.ts', /`git rm`/],
  ['git mv src/main.ts src/contexts/invoicing/main.ts', /`git mv` changes src\/main\.ts/],
  ['git clean -fd', /`git clean` changes the whole project/],
  ['git apply invoicing.patch', /`git apply`/],
  ['patch -p1 < invoicing.patch', /`patch`/],
  ['find . -name "*.orig" -delete', /`find -delete` changes files anywhere in the project/],
  ['find src -name "*.orig" -exec rm {} \\;', /`rm` changes files under src/],
  ['find src -name "*.ts" -exec sed -i "s/a/b/" {} +', /`sed -i` editing/],
  ['ls src | xargs rm', /`rm` changes files only the shell knows/],
  ['bash -c "echo x > src/main.ts"', /redirection/],
  ["sh -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['eval "rm src/main.ts"', /`rm`/],
  ['echo $(rm src/main.ts)', /`rm`/],
  ['cd src && rm main.ts', /`rm` changes src\/main\.ts/],
  ['FORCE=1 rm src/main.ts', /`rm`/],
  ['sudo rm src/main.ts', /`rm`/],
  ['npx prettier --write src', /not the formatter of this project.*npm run format/],
  ['npx biome format --write .', /without `--no`.*npm run format/],
  ['npx -y biome@2 check .', /without `--no`/],
  ['pnpm dlx prettier --check .', /npm run format/],
];

test('a context worker changes no file outside its scope, by any tool: the table of its Bash commands', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of WORKER_COMMANDS_ALLOWED) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  for (const [command, expected] of WORKER_COMMANDS_REFUSED) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  const redirected = reason(run('pre-bash', bash(root, 'echo x > src/main.ts', agent)));
  assert.match(redirected, /You build the context "invoicing"/);
  assert.match(redirected, /system temp directory stays free/);
});

test('inline code of a worker runs, and what it changed outside the scope stops the worker until put back', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-1' };
  const inline = "python3 - <<'EOF'\nprint(1)\nEOF";

  // Inside its scope: nothing to put back.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  put(root, 'src/contexts/ordering/domain/notes.md', 'a note');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);

  // Outside: a changed shared file and a new one stop the next command and the next write.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  writeFileSync(join(root, 'package.json'), '{}\n');
  put(root, 'src/platform/extra.ts', 'export const extra = 1;\n');
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /changed files outside your scope: package\.json, src\/platform\/extra\.ts/);
  assert.match(reason(stopped), /`git restore -- package\.json`, then `rm src\/platform\/extra\.ts`/);
  assert.equal(decision(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent))), 'deny');

  // Putting back exactly those files is allowed; anything else stays refused until it is done.
  assert.equal(run('pre-bash', bash(root, 'git restore -- package.json', agent)).output, undefined);
  assert.equal(decision(run('pre-bash', bash(root, 'git restore -- README.md', agent))), 'deny');
  git(root, 'restore', '--', 'package.json');
  assert.equal(run('pre-bash', bash(root, 'rm src/platform/extra.ts', agent)).output, undefined);
  rmSync(join(root, 'src/platform/extra.ts'));
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent)).output, undefined);
});

test('inline code of the conductor is not watched', () => {
  const root = committed();
  worker(root, 'ordering');
  const conductor = { session_id: 'inline', agent_id: undefined };
  assert.equal(
    run('pre-bash', bash(root, "node -e \"require('fs').writeFileSync('package.json', '{}')\"", conductor)).output,
    undefined,
  );
  writeFileSync(join(root, 'package.json'), '{}\n');
  assert.equal(run('pre-bash', bash(root, 'npm test', conductor)).output, undefined);
});

test('the conductor and the other agents are not held to the scope of a worker', () => {
  const root = project({}, ['--package-manager', 'npm']);
  worker(root, 'invoicing');
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  for (const [command] of WORKER_COMMANDS_REFUSED) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
    assert.equal(run('pre-bash', bash(root, command, reviewer)).output, undefined, command);
  }
});

test('the formatter advice and the install advice speak the package manager of the project', () => {
  const root = project({}, ['--package-manager', 'pnpm']);
  const prettier = run('pre-bash', bash(root, 'npx prettier --write .', worker(root, 'invoicing')));
  assert.match(reason(prettier), /`pnpm run format` only, then `pnpm run lint:fix`/);
  rmSync(join(root, 'node_modules'), { recursive: true });
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(briefing, /The dependencies are not installed here: run `pnpm install --frozen-lockfile`/);
  const npm = project({}, ['--package-manager', 'npm']);
  rmSync(join(npm, 'node_modules'), { recursive: true });
  assert.match(run('session', { cwd: npm }).output.hookSpecificOutput.additionalContext, /run `npm ci`/);
  const manifest = JSON.parse(readFileSync(join(npm, 'package.json'), 'utf8'));
  delete manifest.devDependencies['ddd-ts-kit'];
  writeFileSync(join(npm, 'package.json'), JSON.stringify(manifest));
  assert.match(run('session', { cwd: npm }).output.hookSpecificOutput.additionalContext, /`npm i -D ddd-ts-kit`/);
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
    'openapi/openapi.yaml',
    'openapi/back-office.yaml',
    'docs/integration/asyncapi.yaml',
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

// The runs of a context-builder: its tool calls counted inside pre-bash and pre-write, two notices
// before its turn limit, its run recorded in its worktree, its stop checked.
const LIMIT = Number(
  /^maxTurns:\s*(\d+)$/m.exec(readFileSync(join(here, '..', 'agents', 'context-builder.md'), 'utf8'))[1],
);
// The calibration of builder-runs.mjs: a quarter of the calls uncounted for the first, a sixth for the second.
const FIRST_NOTICE = Math.floor((LIMIT - 30) * 0.75);
const SECOND_NOTICE = Math.floor((LIMIT - 12) * 0.85);
const builder = (id, extra = {}) => ({
  agent_type: 'ddd-ts-kit:context-builder',
  agent_id: id,
  session_id: 'conductor',
  ...extra,
});
const noticeOf = (result) => result.output?.hookSpecificOutput?.additionalContext;
const stateKey = (input) =>
  createHash('sha256')
    .update(`${input.session_id ?? ''}\0${input.agent_id ?? ''}`)
    .digest('hex')
    .slice(0, 16);
const runState = (input) => `.ddd-ts-kit/guard/turns-${stateKey(input)}.json`;
const seed = (root, input, state) => put(root, runState(input), JSON.stringify(state));
const agentFile = (root) => JSON.parse(readFileSync(join(root, '.ddd-ts-kit', 'agent.json'), 'utf8'));
const now = () => new Date().toISOString();

test('a context-builder is warned once before its turn limit, counted from its shell and its writes', () => {
  const root = committed();
  worker(root);
  const agent = builder('counted');
  const notices = [];
  for (let call = 1; call <= FIRST_NOTICE; call += 1) {
    const result =
      call % 3 === 0
        ? run('pre-write', { cwd: root, ...write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent) })
        : run('pre-bash', bash(root, 'git status', agent));
    if (noticeOf(result)) {
      notices.push([call, noticeOf(result)]);
    }
  }
  assert.equal(notices.length, 1);
  assert.equal(notices[0][0], FIRST_NOTICE);
  assert.match(notices[0][1], /^ddd-ts-kit: your turn limit is near .* start no other one/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', agent))), undefined);
});

test('the second notice comes once at its threshold, and rides along a refusal', () => {
  const root = committed();
  worker(root);
  const agent = builder('second');
  seed(root, agent, { run: 1, calls: SECOND_NOTICE - 1, notices: ['first'], startedAt: now() });
  const refused = run('pre-bash', bash(root, 'npm i zod', agent));
  assert.equal(decision(refused), 'deny');
  assert.match(noticeOf(refused), /^ddd-ts-kit: your turn limit is close .* Stop changing code/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', agent))), undefined);
  // Crossing both thresholds at once says only the second.
  const late = builder('late');
  seed(root, late, { run: 1, calls: SECOND_NOTICE + 5, notices: [], startedAt: now() });
  assert.match(noticeOf(run('pre-bash', bash(root, 'git status', late))), /turn limit is close/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', late))), undefined);
});

test('two builders are counted apart, and a new run of one starts its count again', () => {
  const root = committed();
  worker(root);
  const [first, second] = [builder('first'), builder('second')];
  seed(root, first, { run: 1, calls: FIRST_NOTICE - 1, notices: [], startedAt: now() });
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', second))), undefined);
  assert.match(noticeOf(run('pre-bash', bash(root, 'git status', first))), /turn limit is near/);
  assert.equal(run('subagent-start', { cwd: root, ...first }).output, undefined);
  const restarted = JSON.parse(readFileSync(join(root, runState(first)), 'utf8'));
  assert.equal(restarted.run, 2);
  assert.equal(restarted.calls, 0);
  assert.deepEqual(restarted.notices, []);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', first))), undefined);
  assert.equal(agentFile(root).run, 2);
});

test('the main session and the other agents are neither counted nor warned', () => {
  const root = committed();
  worker(root);
  const others = [
    { session_id: 'conductor' },
    { session_id: 'conductor', agent_id: 'reviewer', agent_type: 'ddd-ts-kit:architecture-reviewer' },
  ];
  for (const input of others) {
    seed(root, input, { run: 1, calls: FIRST_NOTICE - 1, notices: [] });
    assert.equal(run('pre-bash', bash(root, 'git status', input)).output, undefined);
    assert.equal(run('subagent-start', { cwd: root, ...input }).output, undefined);
    assert.equal(JSON.parse(readFileSync(join(root, runState(input)), 'utf8')).calls, FIRST_NOTICE - 1);
  }
  assert.equal(existsSync(join(root, '.ddd-ts-kit', 'agent.json')), false);
});

test('the worktree of a builder records its agent, and the calls of each row it commits', () => {
  const root = committed();
  const agent = builder('recorder');
  run('pre-bash', bash(root, 'git status', agent));
  assert.equal(existsSync(join(root, '.ddd-ts-kit', 'agent.json')), false, 'never outside a worker');
  worker(root);
  run('pre-bash', bash(root, 'git status', agent));
  run('pre-write', { cwd: root, ...write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent) });
  const commit = 'git add src && git commit -m "feat(ordering): place an order" -m "Slice: M1.14"';
  run('pre-bash', bash(root, commit, agent));
  const recorded = agentFile(root);
  assert.equal(recorded.agentId, 'recorder');
  assert.equal(recorded.sessionId, 'conductor');
  assert.equal(recorded.run, 1);
  assert.equal(recorded.toolCalls, 4);
  assert.deepEqual(recorded.rowCosts, { 'M1.14': 3 });
  assert.match(recorded.runStartHead, /^[0-9a-f]{40}$/);
  assert.ok(Date.parse(recorded.lastSeen) > 0);
});

test('at its own stop, a builder without a current report or with a verified slice uncommitted is kept going once', () => {
  const root = committed();
  worker(root);
  const agent = builder('stopper');
  run('pre-bash', bash(root, 'git status', agent));
  put(root, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  const stopping = { cwd: root, ...agent, stop_hook_active: false };
  const stale = run('subagent-stop', stopping);
  assert.equal(stale.output.decision, 'block');
  assert.match(stale.output.reason, /report\.md` is older than your last commit or change/);
  assert.equal(agentFile(root).lastStop.reportCurrent, false);
  assert.equal(run('subagent-stop', stopping).output, undefined, 'once a run');
  assert.equal(run('subagent-stop', { ...stopping, stop_hook_active: true }).output, undefined);

  const verified = builder('verified');
  run('pre-bash', bash(root, 'git status', verified));
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const later = new Date(Date.now() + 5000);
  put(root, '.ddd-ts-kit/verification.json', JSON.stringify({ at: later.toISOString(), head, ok: true }));
  put(root, '.ddd-ts-kit/report.md', 'Slices done: none.\n');
  const uncommitted = run('subagent-stop', { cwd: root, ...verified, stop_hook_active: false });
  assert.match(uncommitted.output.reason, /verify-slice passed but the slice is not committed/);

  const done = builder('done');
  run('pre-bash', bash(root, 'git status', done));
  rmSync(join(root, '.ddd-ts-kit', 'verification.json'));
  utimesSync(join(root, '.ddd-ts-kit', 'report.md'), later, later);
  assert.equal(run('subagent-stop', { cwd: root, ...done, stop_hook_active: false }).output, undefined);
  assert.equal(agentFile(root).lastStop.reportCurrent, true);
  assert.equal(run('subagent-stop', { cwd: root, ...builder('unknown'), stop_hook_active: false }).output, undefined);
});

test('the hooks add no entry on every tool call: two rare events, filtered by the builder', () => {
  const { hooks } = JSON.parse(readFileSync(join(here, 'hooks.json'), 'utf8'));
  const matchers = Object.entries(hooks).flatMap(([event, entries]) =>
    entries.map((entry) => `${event} ${entry.matcher ?? ''}`),
  );
  assert.deepEqual(matchers, [
    'SessionStart startup|resume|clear|compact',
    'PreToolUse Write|Edit|MultiEdit',
    'PreToolUse Bash',
    'PostToolUse Write|Edit|MultiEdit',
    'Stop ',
    'SubagentStart ^ddd-ts-kit:context-builder$',
    'SubagentStop ^ddd-ts-kit:context-builder$',
  ]);
});

test('malformed input to the runs of a builder never blocks', () => {
  for (const mode of ['subagent-start', 'subagent-stop']) {
    const result = spawnSync('node', [guard, mode], { input: 'not json', encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
  const root = committed();
  worker(root);
  const broken = builder('broken');
  put(root, runState(broken), '{not json');
  assert.equal(run('pre-bash', bash(root, 'git status', broken)).status, 0);
});

test('session start names the workers to resume, and asks the CLI nothing without a worker worktree', () => {
  const root = committed();
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.ddd-ts-kit/\n');
  const calls = join(root, 'node_modules', 'calls.log');
  writeFileSync(calls, '');
  writeFileSync(
    join(root, 'node_modules', '.bin', 'ddd-ts-kit'),
    `#!/bin/sh\necho "$*" >> "${calls}"\nexec node "${cli}" "$@"\n`,
    { mode: 0o755 },
  );
  assert.doesNotMatch(run('session', { cwd: root }).output.hookSpecificOutput.additionalContext, /Worker to resume/);
  assert.doesNotMatch(readFileSync(calls, 'utf8'), /status/);

  const worktree = join(dirname(root), `${root.split('/').pop()}-ordering`);
  git(root, 'worktree', 'add', '--quiet', '-b', 'build/ordering', worktree);
  put(worktree, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'ordering', rows: ['3'], base: 'main' }));
  put(worktree, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  const old = '2020-01-01T00:00:00.000Z';
  const agent = { agentId: 'a1b2', run: 1, runStartedAt: old, runStartHead: null, lastSeen: old, toolCalls: 80 };
  put(worktree, '.ddd-ts-kit/agent.json', JSON.stringify({ ...agent, rowCosts: {}, lastStop: null }));
  const briefing = run('session', { cwd: root }).output.hookSpecificOutput.additionalContext;
  assert.match(
    briefing,
    /^Worker to resume: build\/ordering \(mid-row, agent a1b2\): `npx ddd-ts-kit worker-scope ordering --resume`, then send what it prints\.$/m,
  );
});
