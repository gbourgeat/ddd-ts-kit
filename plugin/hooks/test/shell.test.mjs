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
  "echo 'rm src/main.ts > src/main.ts'",
  'echo "a \\"quoted\\" rm src/main.ts, a \\d" > /dev/null',
  'echo "one line \\\ncontinued" > /dev/null',
  'ls src/contexts/invoicing \\',
  'bash scripts/check.sh',
  'find src/contexts/invoicing',
  'timeout --help',
  'cd && echo x > "$TMPDIR/notes.txt"',
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

test('commands nested five deep are read, and a deeper one is refused rather than let through unread', () => {
  const root = project();
  const agent = worker(root);
  assert.equal(decision(run('pre-bash', bash(root, `${'eval '.repeat(5)}rm src/main.ts`, agent))), 'deny');
  const deeper = run('pre-bash', bash(root, `${'eval '.repeat(6)}rm src/main.ts`, agent));
  assert.equal(decision(deeper), 'deny');
  assert.match(reason(deeper), /nested deeper than the guard reads/);
});

// A `cd` that is not certain leaves the place to the shell: the reader follows it only after `&&`,
// at the top level, into a directory that exists. A relative write after it names nothing it can
// place, so it is refused.
const UNCERTAIN_CD = [
  'cd /nonexistent 2>/dev/null; echo x > src/main.ts',
  'false && cd /tmp; echo x > src/main.ts',
  '(cd /tmp); echo x > src/main.ts',
  'cd /tmp | cat; rm src/main.ts',
  'cd /tmp & echo x > src/main.ts',
  'cd src && cd /nonexistent && echo x > main.ts',
  // A cd inside a function body, a brace group or the body of an if is not certain either.
  'f() { cd /tmp && echo; }; rm src/main.ts',
  '{ cd /tmp && true; }; rm src/main.ts',
  'if true; then cd /tmp && true; fi; rm src/main.ts',
];

test('a cd that is not certain does not move the reader, and a relative write after it is refused', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of UNCERTAIN_CD) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /files only the shell knows/, command);
  }
  // A certain first cd is followed, an uncertain second one is not.
  const chained = run('pre-bash', bash(root, 'cd src && cd /nonexistent 2>/dev/null; echo x > main.ts', agent));
  assert.equal(decision(chained), 'deny');
  assert.match(reason(chained), /files only the shell knows/);
});

// Each word holds a brace list or range: the place it stands for only the shell knows.
const BRACE_WRITES = [
  'rm src/contexts/invoicing/{x,../../main.ts}',
  'touch src/contexts/invoicing/{x,../../platform/evil.ts}',
  'echo x | tee src/contexts/invoicing/{x,../../main.ts}',
];

test('a word holding a brace list or range is a place only the shell knows', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of BRACE_WRITES) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /files only the shell knows/, command);
  }
});

// Each runs a write the tables know, behind a name the shell computes, a keyword, a wrapper that
// takes a leading operand, a package runner, `su -c`, or `env -S`.
const COMPUTED_AND_WRAPPED = [
  ['$CMD src/main.ts', /only the shell knows/],
  ['${RM:-rm} src/main.ts', /only the shell knows/],
  ['$(which rm) src/main.ts', /only the shell knows/],
  ['eval "$CMD"', /only the shell knows/],
  ['eval $(echo rm src/main.ts)', /only the shell knows/],
  ['coproc rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['ionice -c3 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['setsid rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['taskset -c 0 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['chrt 0 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['flock /tmp/lock rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['taskset 0x3 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['parallel -j 4 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ["flock /tmp/lock -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ["flock /tmp/lock --command 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['doas rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['watch rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['parallel rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['toybox rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['busybox cp a src/main.ts', /`cp` changes src\/main\.ts/],
  ['npx rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx -y rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx -p shx rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['bunx rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npm exec -- rm src/main.ts', /`rm` changes src\/main\.ts/],
  ["npx -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ["npm exec --call 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['pnpm dlx rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['yarn dlx rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['su -c "rm src/main.ts" builder', /`rm` changes src\/main\.ts/],
  ['script -c "rm src/main.ts" /tmp/typescript', /`rm` changes src\/main\.ts/],
  ["env -S 'cp a src/main.ts'", /`cp` changes src\/main\.ts/],
  ["env -S'cp a src/main.ts'", /`cp` changes src\/main\.ts/],
  ["env --split-string 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ["env --split-string='rm src/main.ts'", /`rm` changes src\/main\.ts/],
];

test('a command whose name the shell computes, or a wrapper that hides it, is read for what it runs', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of COMPUTED_AND_WRAPPED) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  // A package runner with no command, and env without -S around a reader, run as they read.
  for (const command of ['npx --version', 'env -i node --version']) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

// Inside `$(...)` the reader skips a double-quoted string (with its `\"`), a backslash escape and a
// nested backquote the same way it skips a single-quoted one, so a write after them is still found.
const SUBSTITUTION_HIDES = [
  'echo "$(echo ")")" ; rm src/main.ts',
  'echo "$(echo `date` ; rm src/main.ts)"',
  'echo "$(echo a\\\\b ; rm src/main.ts)"',
  'echo "$(echo "a\\"b" ; rm src/main.ts)"',
];

// A package runner, `su -c` or `env -S` behind another wrapper is read through each layer.
const BEHIND_A_WRAPPER = [
  ['nice -n 10 npx eslint --fix src/main.ts', /`eslint` changes src\/main\.ts/],
  ['timeout 60 npx vitest run --outputFile=src/main.ts', /`vitest` changes src\/main\.ts/],
  ["sudo su -c 'rm src/main.ts' root", /`rm` changes src\/main\.ts/],
  ["nice env -S 'cp a src/main.ts'", /`cp` changes src\/main\.ts/],
];

test('a runner or a command string behind a wrapper is read for what it runs', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of BEHIND_A_WRAPPER) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
});

test('a double quote, an escape or a backquote inside a substitution does not hide the commands after it', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of SUBSTITUTION_HIDES) {
    assert.match(reason(run('pre-bash', bash(root, command, agent))), /`rm` changes src\/main\.ts/, command);
  }
  // A double quote or a backquote left open inside the substitution runs to the end, no crash.
  assert.equal(run('pre-bash', bash(root, 'echo "$(echo "unterminated', agent)).status, 0);
  assert.equal(run('pre-bash', bash(root, 'echo "$(echo `unterminated)"', agent)).status, 0);
});

test('without TMPDIR in the environment, the system temp directory stays free to a worker', () => {
  const root = project();
  const agent = worker(root);
  const noted = bash(root, 'echo x > "$TMPDIR/notes.txt" && echo y > "${TMPDIR:-/tmp}/more.txt"', agent);
  assert.equal(run('pre-bash', noted, { TMPDIR: undefined }).output, undefined);
});

test('a glob that starts outside the project is not walked, and a chain of wrappers longer than the guard reads names no program', () => {
  const root = project();
  const agent = worker(root);
  const started = Date.now();
  assert.equal(decision(run('pre-bash', bash(root, 'rm /**/.cache src/main.ts'))), undefined);
  assert.ok(Date.now() - started < 4000, 'answered without walking the disk');
  const wrapped = run('pre-bash', bash(root, `${'nice '.repeat(40)}rm src/main.ts`, agent));
  assert.equal(decision(wrapped), 'deny');
  assert.match(reason(wrapped), /name only the shell knows/);
  assert.equal(run('pre-bash', bash(root, `${'nice '.repeat(3)}ls`, agent)).output, undefined);
});
