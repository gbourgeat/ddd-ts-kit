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


test('the ordinary forms of a write to a registry are asked', () => {
  for (const command of [
    "sed -E -i 's/a/b/' pipeline/monorepo/families.mjs",
    "sed --in-place 's/a/b/' pipeline/monorepo/families.mjs",
    "sed -ni 's/a/b/p' pipeline/monorepo/families.mjs",
    'rm pipeline/monorepo/families.mjs',
    "awk -i inplace '{print}' pipeline/monorepo/families.mjs",
    'dd of=pipeline/monorepo/families.mjs if=/tmp/x',
    'git mv pipeline/monorepo/families.mjs /tmp/x',
    'cat /tmp/x > pipeline/monorepo/families.mjs',
    'ls && rm -f pipeline/monorepo/families.mjs',
    'FOO=1 nice -n 10 sed -i s/a/b/ packages/cli/test/support/support-matrix.ts',
    'echo $(truncate -s 0 pipeline/monorepo/families.mjs)',
  ]) {
    assert.equal(ask(command), 'ask', command);
  }
});

test('the readers of a registry go through', () => {
  for (const command of [
    'cat pipeline/monorepo/families.mjs',
    'grep -n x pipeline/monorepo/families.mjs 2>&1',
    'git diff pipeline/monorepo/families.mjs',
    'git -c core.pager=cat log -p packages/cli/test/support/support-matrix.ts',
    'git add pipeline/monorepo/families.mjs',
    'node --check pipeline/monorepo/families.mjs',
    "sed -n '1,20p' pipeline/monorepo/families.mjs",
    'nice -n 10 head -5 pipeline/monorepo/families.mjs 2>/dev/null | wc -l',
    'LC_ALL=C wc -l pipeline/monorepo/families.mjs',
    'diff pipeline/monorepo/families.mjs /tmp/x',
  ]) {
    assert.equal(ask(command), undefined, command);
  }
});

function ask(command) {
  return decisionFor({ tool_name: 'Bash', tool_input: { command } })?.hookSpecificOutput.permissionDecision;
}
