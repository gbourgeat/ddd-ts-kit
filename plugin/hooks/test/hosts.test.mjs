// The hosts: Codex and its patches, Copilot and its own hook format, and an input the guard cannot read.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { decision, directory, guard, patch, project, put, reason, run, runFrom, worker, write } from './support.mjs';

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

test('Codex: an apply_patch run through the shell tool is read as a patch, held to the scope', () => {
  const root = project();
  const agent = worker(root);
  const out = ['*** Begin Patch', '*** Add File: src/contexts/billing/x.ts', '+export const x = 1;', '*** End Patch'];
  const stray = {
    cwd: root,
    turn_id: 'turn-1',
    tool_name: 'shell',
    tool_input: { command: `apply_patch <<'EOF'\n${out.join('\n')}\nEOF` },
    ...agent,
  };
  const result = run('pre-bash', stray);
  assert.equal(decision(result), 'deny');
  assert.match(reason(result), /another bounded context/);
  const inside = [
    '*** Begin Patch',
    '*** Add File: src/contexts/ordering/y.ts',
    '+export const y = 1;',
    '*** End Patch',
  ];
  const allowed = { ...stray, tool_input: { command: `apply_patch <<'EOF'\n${inside.join('\n')}\nEOF` } };
  assert.equal(run('pre-bash', allowed).output, undefined);
});

test('Codex: the rest of a command line around an apply_patch is read as any other shell command', () => {
  const root = project();
  const inside = [
    '*** Begin Patch',
    '*** Add File: src/contexts/ordering/y.ts',
    '+export const y = 1;',
    '*** End Patch',
  ];
  const around = `git commit --no-verify -m x && apply_patch <<'EOF'\n${inside.join('\n')}\nEOF`;
  assert.match(reason(run('pre-bash', codexShell(root, around))), /local gate of the pipeline/);
  assert.match(reason(run('pre-bash', codexShell(root, 'git commit --no-verify -m x'))), /local gate/);
});

test('Codex: a here-document that only holds the text of a patch is a write of its file, not a patch', () => {
  const root = project();
  const agent = worker(root);
  const text = ['*** Begin Patch', '*** Add File: src/contexts/billing/x.ts', '+x', '*** End Patch'];
  const noted = run('pre-bash', codexShell(root, `cat <<'EOF' > notes.md\n${text.join('\n')}\nEOF`, agent));
  assert.equal(decision(noted), 'deny');
  assert.match(reason(noted), /notes\.md/);
  assert.doesNotMatch(reason(noted), /another bounded context/);
});

test('Codex: a patch through the shell that touches the rules is said to the user, the rest of the line passing', () => {
  const root = project();
  const rules = ['*** Begin Patch', '*** Update File: eslint.config.js', '+// a rule', '*** End Patch'];
  const result = run('pre-bash', codexShell(root, `apply_patch <<'EOF'\n${rules.join('\n')}\nEOF`));
  assert.match(result.output.systemMessage, /holds the rules or the pipeline/);
});

// A shell call of Codex, its command given.
function codexShell(root, command, extra = {}) {
  return { cwd: root, turn_id: 'turn-1', tool_name: 'shell', tool_input: { command }, ...extra };
}

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

test('an input that is JSON but not an object never blocks, in any mode', () => {
  for (const mode of ['session', 'pre-write', 'pre-bash', 'post-write', 'stop', 'subagent-start', 'subagent-stop']) {
    const result = spawnSync('node', [guard, mode], { cwd: directory('none'), input: 'null', encoding: 'utf8' });
    assert.equal(result.status, 0, mode);
    assert.equal(result.stdout, '', mode);
  }
});

test('Copilot: tool arguments that are not JSON never block', () => {
  const root = project();
  const unread = { cwd: root, sessionId: 'session-1', toolName: 'create', toolArgs: '{"path": "src/contexts' };
  assert.equal(run('pre-write', unread).output, undefined);
});

test('Codex: a patch that moves a file to the place of a generated role is refused as a new file of that role', () => {
  const root = project();
  put(root, 'src/contexts/ordering/domain/order-draft.ts', 'export class Order {}\n');
  const moved = patch(
    root,
    '*** Update File: src/contexts/ordering/domain/order-draft.ts',
    '*** Move to: src/contexts/ordering/domain/aggregates/order.aggregate.ts',
    '@@',
    '+export class Order {}',
  );
  assert.equal(decision(run('pre-write', moved)), 'deny');
  assert.match(reason(run('pre-write', moved)), /order\.aggregate\.ts is a new file of a generated role/);
});

test('a host that sends no working directory has the guard read the directory it starts the hook in', () => {
  const root = project();
  const agent = worker(root);
  const started = runFrom(root, 'session', {}).output.hookSpecificOutput.additionalContext;
  assert.match(started, /ordering \[core\]/);
  for (const command of [
    'git commit --no-verify -m x',
    'git merge -X theirs main',
    'npx ddd-ts-kit worker-scope ordering',
    'npx ddd-ts-kit merge-trunk --to-land',
    'npx ddd-ts-kit acceptance US5 --lock',
    'echo x > test/acceptance/verdicts/us5-1.md',
    'npx ddd-ts-kit generate repository ordering Order',
  ]) {
    const input = { tool_name: 'Bash', tool_input: { command }, ...agent };
    assert.equal(decision(runFrom(root, 'pre-bash', input)), 'deny', command);
  }
  put(root, 'src/contexts/ordering/domain/services/pricing.service.ts', "import express from 'express';\n");
  assert.equal(runFrom(root, 'stop', {}).output.decision, 'block');
});

test('Codex: every patch of a line is judged, a delete and a move included, and one the command does not hold is refused', () => {
  const root = project();
  put(root, 'ddd-ts-kit-baseline.json', '{}');
  const begin = '*** Begin Patch';
  const end = '*** End Patch';
  const generated = ['*** Add File: openapi/openapi.yaml', '+x'];
  const harmless = ['*** Add File: notes.md', '+x'];
  const second = `apply_patch <<'EOF'\n${[begin, ...harmless, end].join('\n')}\nEOF\napply_patch <<'EOF'\n${[begin, ...generated, end].join('\n')}\nEOF`;
  assert.match(reason(run('pre-bash', codexShell(root, second))), /openapi\/openapi\.yaml is generated/);
  const argument = `apply_patch '${[begin, ...generated, end].join('\n')}'`;
  assert.match(reason(run('pre-bash', codexShell(root, argument))), /openapi\/openapi\.yaml is generated/);
  for (const command of ['apply_patch < /tmp/change.patch', 'cat /tmp/change.patch | apply_patch']) {
    assert.match(reason(run('pre-bash', codexShell(root, command))), /holds the patch/, command);
  }
  for (const sections of [
    ['*** Delete File: ddd-ts-kit-baseline.json'],
    ['*** Update File: ddd-ts-kit-baseline.json', '*** Move to: old-baseline.json', '-{}', '+{}'],
  ]) {
    assert.match(reason(run('pre-write', patch(root, ...sections))), /ddd-ts-kit-baseline\.json/);
  }
  put(root, 'openapi/openapi.yaml', 'x\n');
  assert.equal(run('pre-write', patch(root, '*** Delete File: openapi/openapi.yaml')).output, undefined);
  assert.equal(run('post-write', patch(root, '*** Delete File: src/contexts/ordering/gone.ts')).output, undefined);
  assert.equal(
    run('pre-bash', codexShell(directory('no-project'), 'apply_patch < /tmp/change.patch')).output,
    undefined,
  );
  const asked = run('pre-bash', codexShell(project({ guard: 'advise' }), 'apply_patch < /tmp/p'));
  assert.match(asked.output.systemMessage, /holds the patch/);
  assert.equal(run('pre-bash', codexShell(project({ guard: 'off' }), 'apply_patch < /tmp/p')).output, undefined);
});
