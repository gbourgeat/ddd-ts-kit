// The hosts: Codex and its patches, Copilot and its own hook format, and an input the guard cannot read.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { decision, directory, guard, patch, project, put, reason, run, write } from './support.mjs';

test('outside a ddd-ts-kit project every mode stays silent', () => {
  const elsewhere = directory('none');
  for (const mode of ['session', 'pre-write', 'post-write', 'stop']) {
    const result = run(mode, { cwd: elsewhere, ...write(join(elsewhere, 'a.aggregate.ts')) });
    assert.equal(result.status, 0);
    assert.equal(result.output, undefined);
  }
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

test('malformed input never blocks', () => {
  const result = spawnSync('node', [guard, 'pre-write'], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
