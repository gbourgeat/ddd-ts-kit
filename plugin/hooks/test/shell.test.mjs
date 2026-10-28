// The reader of the shell, as a context worker meets it: a command line is split as the shell splits it,
// so that a write hidden in a quote, a comment, a substitution, a continued line or a wrapper is found,
// and a text that only looks like a command is not.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bash, decision, project, reason, run, worker } from './support.mjs';

// Each runs `rm` on a file outside the scope of the worker, or writes one, however it is written.
const HIDDEN_WRITES = [
  ['rm \\\n  src/main.ts', /`rm` changes src\/main\.ts/],
  ['# a note first\nrm src/main.ts', /`rm` changes src\/main\.ts/],
  ['echo "$(rm src/main.ts)"', /`rm` changes src\/main\.ts/],
  ['echo "`rm src/main.ts`"', /`rm` changes src\/main\.ts/],
  ["echo $(echo ')' && rm src/main.ts)", /`rm` changes src\/main\.ts/],
  ['echo $(rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['echo `rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['> src/main.ts', /the redirection `> src\/main\.ts`/],
  ['nice -n 10 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['timeout 5 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['cat <<-EOF > /dev/null\n\tA note.\n\tEOF\nrm src/main.ts', /`rm` changes src\/main\.ts/],
  ['find src -name "*.orig" -exec rm {}', /`rm` changes files under src/],
  ['find -name "*.orig" -exec rm {} +', /`rm` changes files anywhere in the project/],
  ['pushd src && popd +1 && rm main.ts', /`rm` changes src\/main\.ts/],
  ['pushd +1 && rm main.ts', /`rm` changes files only the shell knows/],
  ['cd - && rm main.ts', /`rm` changes files only the shell knows/],
];

// Each only looks like a write: the text of a quote or a comment, a script run by name, a reading.
const TEXTS = [
  'npm test # then rm src/main.ts',
  "echo 'rm src/main.ts > src/main.ts",
  'echo "a \\"quoted\\" rm src/main.ts, a \\d" > /dev/null',
  'echo "one line \\\ncontinued" > /dev/null',
  'ls src/contexts/invoicing \\',
  'bash scripts/check.sh',
  'find src/contexts/invoicing',
  'timeout --help',
  'cd && echo x > notes.txt',
];

test('the shell is read as it splits a command line: quotes, comments, substitutions, continuations and wrappers', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of HIDDEN_WRITES) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const command of TEXTS) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('commands nested five deep are read', () => {
  const root = project();
  const agent = worker(root);
  assert.equal(decision(run('pre-bash', bash(root, `${'eval '.repeat(5)}rm src/main.ts`, agent))), 'deny');
  // Deeper than the reader follows: the guard still answers without failing (what it decides there is not pinned).
  assert.equal(run('pre-bash', bash(root, `${'eval '.repeat(6)}rm src/main.ts`, agent)).status, 0);
});

test.todo('a command nested deeper than the reader follows is refused');

test('without TMPDIR in the environment, the system temp directory stays free to a worker', () => {
  const root = project();
  const agent = worker(root);
  const noted = bash(root, 'echo x > "$TMPDIR/notes.txt" && echo y > "${TMPDIR:-/tmp}/more.txt"', agent);
  assert.equal(run('pre-bash', noted, { TMPDIR: undefined }).output, undefined);
});
