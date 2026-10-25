import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decisionFor } from './ask-before-an-asymmetry.mjs';

test('an edit of a registry of asymmetries is asked to the maintainer', () => {
  const edit = { tool_name: 'Edit', tool_input: { file_path: '/repo/pipeline/monorepo/families.mjs' } };

  assert.equal(decisionFor(edit)?.hookSpecificOutput.permissionDecision, 'ask');
});

test('a shell command that names a registry is asked too', () => {
  const sed = {
    tool_name: 'Bash',
    tool_input: { command: "sed -i 's/a/b/' packages/cli/test/support/support-matrix.ts" },
  };

  assert.equal(decisionFor(sed)?.hookSpecificOutput.permissionDecision, 'ask');
});

test('any other file goes through', () => {
  assert.equal(
    decisionFor({ tool_name: 'Write', tool_input: { file_path: '/repo/pipeline/monorepo/parity.mjs' } }),
    undefined,
  );
  assert.equal(decisionFor({ tool_name: 'Bash', tool_input: { command: 'npm run check:parity' } }), undefined);
  assert.equal(
    decisionFor({ tool_name: 'Bash', tool_input: { command: 'cat pipeline/monorepo/families.mjs' } }),
    undefined,
  );
});
