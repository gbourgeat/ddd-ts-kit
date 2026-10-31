// Before a write of package.json: a change of its scripts, which the gates run, needs the owner; a
// change of its dependencies does not.

import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { decision, edit, patch, project, put, reason, run, write } from './support.mjs';

test('a write of package.json is asked when its scripts change, and only then', () => {
  const root = project();
  const manifest = manifestOf(root);
  const dependencies = run('pre-write', written(root, { ...manifest, dependencies: { zod: '^4.0.0' } }));
  assert.equal(dependencies.output, undefined);
  const added = run('pre-write', written(root, { ...manifest, scripts: { ...manifest.scripts, 'ci:skip': 'true' } }));
  assert.equal(decision(added), 'ask');
  assert.match(reason(added), /changes the script `ci:skip`: the scripts of package\.json are what the gates/);
  const { lint, ...withoutLint } = manifest.scripts;
  assert.equal(typeof lint, 'string');
  const removed = run('pre-write', written(root, { ...manifest, scripts: { ...withoutLint, build: 'true' } }));
  assert.match(reason(removed), /changes the scripts `lint`, `build`|changes the scripts `build`, `lint`/);
});

test('an edit of package.json is applied to the file before its scripts are compared, whatever the host', () => {
  const root = project();
  const file = join(root, 'package.json');
  put(root, 'package.json', JSON.stringify({ name: 'shop', scripts: { lint: 'eslint .', test: 'vitest' } }, null, 2));
  const version = run('pre-write', edit(file, { from: '"name": "shop"', to: '"name": "shop", "version": "1.0.0"' }));
  assert.equal(version.output, undefined);
  const changed = run('pre-write', edit(file, { from: '"eslint ."', to: '"true"' }));
  assert.match(reason(changed), /changes the script `lint`/);
  const everywhere = run('pre-write', {
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string: 'vitest', new_string: 'true', replace_all: true },
  });
  assert.match(reason(everywhere), /changes the script `test`/);
});

test('the edits of a MultiEdit and the fields of Copilot are applied to the file as well', () => {
  const root = project();
  const file = join(root, 'package.json');
  put(root, 'package.json', JSON.stringify({ name: 'shop', scripts: { lint: 'eslint .', test: 'vitest' } }, null, 2));
  const several = run('pre-write', {
    tool_name: 'MultiEdit',
    tool_input: {
      file_path: file,
      edits: [
        { old_string: '"eslint ."', new_string: '"eslint src"' },
        { old_string: '"name": "shop"', new_string: '"name": "store"' },
      ],
    },
  });
  assert.match(reason(several), /changes the script `lint`:/);
  const copilot = run('pre-write', {
    tool_name: 'Edit',
    tool_input: { path: file, old_str: '"vitest"', new_str: '"vitest run"' },
  });
  assert.match(reason(copilot), /changes the script `test`/);
  const created = run('pre-write', {
    tool_name: 'Edit',
    tool_input: {
      path: file,
      file_text: JSON.stringify({ name: 'shop', scripts: { lint: 'eslint .', test: 'vitest' } }),
    },
  });
  assert.equal(created.output, undefined);
});

test('the editor tools of VS Code are applied to the file as well, each replacement in turn on its own file', () => {
  const root = project();
  const file = join(root, 'package.json');
  const manifest = { name: 'shop', scripts: { lint: 'eslint .', test: 'vitest' }, version: '1.0.0' };
  put(root, 'package.json', JSON.stringify(manifest, null, 2));
  const created = { filePath: file, content: JSON.stringify({ ...manifest, scripts: { lint: 'true' } }) };
  assert.match(
    reason(run('pre-write', vsCodeCall(root, 'create_file', created))),
    /changes the scripts `lint`, `test`/,
  );
  const same = { filePath: file, content: JSON.stringify({ ...manifest, version: '2.0.0' }) };
  assert.equal(run('pre-write', vsCodeCall(root, 'create_file', same)).output, undefined);
  const changed = { filePath: file, oldString: '"vitest"', newString: '"true"' };
  const replaced = run('pre-write', vsCodeCall(root, 'replace_string_in_file', changed));
  assert.match(reason(replaced), /changes the script `test`/);
  const named = { filePath: file, oldString: '"name": "shop"', newString: '"name": "store"' };
  assert.equal(run('pre-write', vsCodeCall(root, 'replace_string_in_file', named)).output, undefined);
  put(root, 'other.json', JSON.stringify(manifest, null, 2));
  const other = { filePath: join(root, 'other.json'), oldString: '"eslint ."', newString: '"true"' };
  const elsewhere = [named, other];
  const multi = (replacements) => vsCodeCall(root, 'multi_replace_string_in_file', { replacements });
  assert.equal(run('pre-write', multi(elsewhere)).output, undefined);
  const note = { filePath: file, oldString: '"version": "1.0.0"', newString: '"version": "1.0.0", "note": "x"' };
  const turned = { filePath: file, oldString: '"note": "x"', newString: '"scripts": { "lint": "true" }' };
  assert.equal(run('pre-write', multi([note])).output, undefined);
  assert.equal(run('pre-write', multi([turned])).output, undefined);
  assert.match(reason(run('pre-write', multi([note, other, turned]))), /changes the scripts `lint`, `test`/);
  const inserted = run('pre-write', vsCodeCall(root, 'insert_edit_into_file', { filePath: file, code: '"x": 1' }));
  assert.match(reason(inserted), /cannot read the scripts/);
});

function vsCodeCall(root, tool_name, tool_input) {
  return { cwd: root, session_id: 'vscode-session', tool_name, tool_input };
}

test('a package.json the guard cannot read the scripts of is asked, and so is a patch it does not rebuild', () => {
  const root = project();
  const file = join(root, 'package.json');
  assert.match(reason(run('pre-write', write(file))), /leaves a package\.json the guard cannot read the scripts of/);
  assert.match(reason(run('pre-write', written(root, ['not', 'a', 'manifest']))), /cannot read the scripts/);
  assert.match(
    reason(run('pre-write', { tool_name: 'Edit', tool_input: { file_path: file, old_string: 'x' } })),
    /cannot read/,
  );
  const patched = run(
    'pre-write',
    patch(root, '*** Update File: package.json', '@@', '-  "name": "x"', '+  "name": "y"'),
  );
  // Codex has no question to put: the guard says it in a message of the session.
  assert.match(patched.output.systemMessage, /cannot read the scripts/);
});

test('a package.json without scripts, or none before the write, is compared with no script at all', () => {
  const root = project();
  const file = join(root, 'package.json');
  put(root, 'package.json', JSON.stringify({ name: 'shop', scripts: 'none' }));
  assert.equal(run('pre-write', written(root, { name: 'shop' })).output, undefined);
  rmSync(file);
  assert.equal(run('pre-write', written(root, { name: 'shop', scripts: {} })).output, undefined);
  assert.match(reason(run('pre-write', written(root, { name: 'shop', scripts: { lint: 'eslint .' } }))), /`lint`/);
  put(root, 'packages/web/package.json', '{}');
  assert.equal(run('pre-write', write(join(root, 'packages/web/package.json'))).output, undefined);
});

function manifestOf(root) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
}

function written(root, manifest) {
  return write(join(root, 'package.json'), {
    tool_input: { file_path: join(root, 'package.json'), content: JSON.stringify(manifest, null, 2) },
  });
}
