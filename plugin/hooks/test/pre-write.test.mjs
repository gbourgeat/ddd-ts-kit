// Before a write: generated files and roles, the files of the rules, suppressions, and on trial the imports a
// dependency rule refuses.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { bash, cli, decision, git, patch, patchConfig, project, put, reason, run, worker, write } from './support.mjs';

test('a new file of a generated role is refused with the generator command', () => {
  const root = project();
  const { output } = run('pre-write', write(join(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts')));
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /generate aggregate/);
});

test('a new value object or refusal of the shared kernel is refused with its generator, its spec is not', () => {
  const root = project();
  const money = run('pre-write', write(join(root, 'src/shared-kernel/money.vo.ts')));
  assert.equal(decision(money), 'deny');
  assert.match(reason(money), /generate value-object shared-kernel <Name> --term/);
  const refusal = run('pre-write', write(join(root, 'src/shared-kernel/invalid-money.error.ts')));
  assert.match(reason(refusal), /generate error shared-kernel <Refusal> <factory>/);
  assert.equal(run('pre-write', write(join(root, 'src/shared-kernel/money.vo.spec.ts'))).output, undefined);
  assert.equal(run('pre-write', write(join(root, 'src/shared-kernel/storable-stamp.ts'))).output, undefined);
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

test('a generated contract is never edited by hand, in YAML, in JSON, split into documents or as the form of a route', () => {
  const root = project();
  for (const file of [
    'openapi/openapi.yaml',
    'openapi/openapi.json',
    'openapi/back-office.yaml',
    'openapi/forms/createOrder.json',
    'docs/integration/asyncapi.yaml',
    'docs/integration/asyncapi.json',
    'docs/integration/event-catalog.md',
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

test('the generated barrel and the generated import graph rules are never edited by hand', () => {
  const root = project();
  const barrel = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.declarations.ts')));
  assert.equal(decision(barrel), 'deny');
  assert.match(reason(barrel), /ddd-ts-kit docs/);
  for (const folder of [
    'application/application.declarations.ts',
    'infrastructure/infrastructure.declarations.ts',
    'application/commands/commands.declarations.ts',
  ]) {
    const declarations = run('pre-write', write(join(root, `src/contexts/ordering/${folder}`)));
    assert.equal(decision(declarations), 'deny', folder);
    assert.match(reason(declarations), /generated declarations .* ddd-ts-kit docs/, folder);
  }
  const named = run(
    'pre-write',
    write(join(root, 'src/contexts/ordering/application/commands/orders.declarations.ts')),
  );
  assert.doesNotMatch(named.output === undefined ? '' : reason(named), /generated declarations/);
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

test('the declarations of the use cases of a module are not a policy file: they go to the module file of the module', () => {
  const root = project();
  const result = run(
    'pre-write',
    write(join(root, 'src/contexts/ordering/application/authorization/declare-sales-use-cases.policy.ts')),
  );
  assert.equal(decision(result), 'deny');
  assert.match(reason(result), /generate policy /);
  assert.match(reason(result), /requires\(\.\.\.\)/);
  assert.match(reason(result), /<module>\/<module>\.module\.ts/);
  assert.match(reason(result), /--module <module>/);
  assert.match(reason(result), /generate module/);
});

test('a long end-to-end spec is split by behaviour into parts named after it', () => {
  const root = project();
  const part = join(root, 'test/e2e/place-order-refusals.e2e.spec.ts');
  const alone = run('pre-write', write(part));
  assert.equal(decision(alone), 'deny');
  assert.match(reason(alone), /generate e2e /);
  assert.match(
    reason(alone),
    /test\/e2e\/<use-case>-<behaviour>\.e2e\.spec\.ts beside test\/e2e\/<use-case>\.e2e\.spec\.ts/,
  );
  assert.match(reason(alone), /test\/e2e\/journey-<name>\.e2e\.spec\.ts/);
  put(root, 'test/e2e/place-order.e2e.spec.ts');
  assert.equal(run('pre-write', write(part)).output, undefined);
  assert.equal(
    run('pre-write', write(join(root, 'test/e2e/place-order-refusals-stock.e2e.spec.ts'))).output,
    undefined,
  );
  // A name that only starts like the spec, without the hyphen, is not a part of it.
  assert.equal(decision(run('pre-write', write(join(root, 'test/e2e/place-orders.e2e.spec.ts')))), 'deny');
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

test('the declarations of a module of the model are generated too, and a module is declared by the conductor', () => {
  const root = project();
  const declared = spawnSync(
    'node',
    [
      cli,
      'generate',
      'module',
      'ordering',
      'orders',
      '--purpose',
      'The orders.',
      '--term',
      'Order=What a customer asks for',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(declared.status, 0, declared.stderr);
  for (const folder of [
    'orders/application/commands/commands.declarations.ts',
    'orders/application/application.declarations.ts',
  ]) {
    const declarations = run('pre-write', write(join(root, `src/contexts/ordering/${folder}`)));
    assert.equal(decision(declarations), 'deny', folder);
    assert.match(reason(declarations), /generated declarations .* ddd-ts-kit docs/, folder);
  }
  const undeclared = run(
    'pre-write',
    write(join(root, 'src/contexts/ordering/application/legacy/commands/commands.declarations.ts')),
  );
  assert.doesNotMatch(undeclared.output === undefined ? '' : reason(undeclared), /generated declarations/);
  const service = run(
    'pre-write',
    write(join(root, 'src/contexts/ordering/orders/domain/services/pricing.service.ts')),
  );
  assert.equal(decision(service), 'deny');
  assert.match(reason(service), /generate domain-service /);
  const agent = worker(root);
  const declaring = run(
    'pre-bash',
    bash(root, 'npx ddd-ts-kit generate module ordering orders --purpose "Orders."', agent),
  );
  assert.equal(decision(declaring), 'deny');
  assert.match(reason(declaring), /conductor runs it on the trunk/);
  // Committed once, with a low commit size, so that the files written next are what the stop hook counts as uncommitted.
  patchConfig(root, { commit: { maxFiles: 3, maxLines: 1000 } });
  writeFileSync(join(root, '.gitignore'), 'node_modules\n');
  git(root, 'init', '--quiet');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'chore: bootstrap');
  const session = { cwd: root, session_id: `s-${root}` };
  assert.equal(run('stop', session).output, undefined);
  for (const file of [
    'orders/application/commands/book-order/book-order.notes.md',
    'orders/application/commands/book-order/book-order.more.md',
    'orders/application/commands/cancel-order/cancel-order.notes.md',
    'orders/domain/value-objects/money.notes.md',
  ]) {
    put(root, join('src/contexts/ordering', file), 'one\ntwo\n');
  }
  const uncommitted = run('stop', session).output.systemMessage;
  assert.match(uncommitted, /ordering: book-order \(2 files\)/);
  assert.match(uncommitted, /ordering: cancel-order \(1 files\)/);
  assert.match(uncommitted, /ordering: domain \(1 files\)/);
});

test('the baseline of the errors is never written by an agent, on any host; prune lowers it freely', () => {
  const root = project();
  const file = join(root, 'ddd-ts-kit-baseline.json');
  assert.equal(decision(run('pre-write', write(file))), 'deny');
  assert.match(reason(run('pre-write', write(file))), /written by the project owner, in a terminal/);
  const patched = run('pre-write', patch(root, '*** Add File: ddd-ts-kit-baseline.json', '+{}'));
  assert.equal(patched.output.hookSpecificOutput.permissionDecision, 'deny');
  for (const command of [
    'npx ddd-ts-kit check --baseline write',
    'pnpm exec ddd-ts-kit check --baseline=write',
    'npx ddd-ts-kit@latest check --baseline write && git add ddd-ts-kit-baseline.json',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command))), 'deny', command);
  }
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit check --baseline prune')).output, undefined);
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit check')).output, undefined);
  const advised = project({ guard: 'advise' });
  assert.equal(decision(run('pre-bash', bash(advised, 'npx ddd-ts-kit check --baseline write'))), 'ask');
});

test('on trial, an import a dependency rule refuses is refused before the write, an import the file held is not', () => {
  const root = project({ dependenciesBeforeWrite: true });
  const file = pricingService(root, "import { z } from 'zod';\nexport class Pricing { shape() { return z; } }\n");
  const edit = (old_string, new_string) => ({
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string, new_string },
  });
  const adding = run('pre-write', edit('export class', "import express from 'express';\nexport class"));
  assert.equal(decision(adding), 'deny');
  assert.match(reason(adding), /layer\/domain-purity/);
  assert.match(reason(adding), /dependenciesBeforeWrite, on trial/);
  assert.doesNotMatch(reason(adding), /zod/);
  const keeping = run(
    'pre-write',
    edit("import { z } from 'zod';\nexport class", "import { z } from 'zod';\n\nexport class"),
  );
  assert.equal(keeping.output, undefined);
  const content = readFileSync(file, 'utf8');
  assert.equal(run('pre-write', { tool_name: 'Write', tool_input: { file_path: file, content } }).output, undefined);
});

test('on trial, a Codex patch is judged on the lines it adds; off, the import waits for the check after the write', () => {
  const root = project({ dependenciesBeforeWrite: true });
  pricingService(root, 'export class Pricing {}\n');
  const added = [
    '*** Update File: src/contexts/ordering/domain/services/pricing.service.ts',
    '@@',
    "+import express from 'express';",
  ];
  assert.equal(decision(run('pre-write', patch(root, ...added))), 'deny');
  const off = project();
  const file = pricingService(off, 'export class Pricing {}\n');
  const edit = { file_path: file, old_string: 'export', new_string: "import express from 'express';\nexport" };
  assert.equal(run('pre-write', { tool_name: 'Edit', tool_input: edit }).output, undefined);
});

test('on trial, each judged write is recorded in the git directory of the repository, for the verdict', () => {
  const root = project({ dependenciesBeforeWrite: true });
  spawnSync('git', ['init', '--quiet'], { cwd: root });
  const file = pricingService(root, 'export class Pricing {}\n');
  const edit = { file_path: file, old_string: 'export', new_string: "import express from 'express';\nexport" };
  assert.equal(decision(run('pre-write', { tool_name: 'Edit', tool_input: edit })), 'deny');
  const [entry] = readFileSync(join(root, '.git/ddd-ts-kit/before-write.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(entry.file, 'src/contexts/ordering/domain/services/pricing.service.ts');
  assert.deepEqual(entry.refused, ['layer/domain-purity']);
  assert.equal(typeof entry.ms, 'number');
});

test('on trial, a CLI that cannot judge the text lets the write through and is recorded as not judged', () => {
  const root = project({ dependenciesBeforeWrite: true });
  spawnSync('git', ['init', '--quiet'], { cwd: root });
  const older = `#!/bin/sh\necho '{"error":{"message":"Unknown option --content-from"}}'\n`;
  writeFileSync(join(root, 'node_modules', '.bin', 'ddd-ts-kit'), older, { mode: 0o755 });
  const file = pricingService(root, 'export class Pricing {}\n');
  const edit = { file_path: file, old_string: 'export', new_string: "import express from 'express';\nexport" };
  assert.equal(run('pre-write', { tool_name: 'Edit', tool_input: edit }).output, undefined);
  const [entry] = readFileSync(join(root, '.git/ddd-ts-kit/before-write.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(entry.unjudged, 'Unknown option --content-from');
  assert.equal(entry.refused, undefined);
});

function pricingService(root, content) {
  const file = join(root, 'src/contexts/ordering/domain/services/pricing.service.ts');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}
