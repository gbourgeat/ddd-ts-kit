// The reader of the shell, as a context worker meets it: a command line is split as the shell splits it,
// so that a write hidden in a quote, a comment, a substitution, a continued line or a wrapper is found,
// and a text that only looks like a command is not.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, conductorWithWorker, decision, project, reason, run, worker } from './support.mjs';

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
  ['flock /dev/null rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['taskset 0x3 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['parallel -j 4 rm src/main.ts', /`rm` changes src\/main\.ts/],
  ["flock /dev/null -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ["flock /dev/null --command 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
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
  ['script -c "rm src/main.ts" /dev/null', /`rm` changes src\/main\.ts/],
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

// The words of the command a package runner runs are those the shell split: a quote, a `>` or a `;`
// inside one of them is text of that word.
const RUNNER_WORDS = [
  `npx ddd-ts-kit lint --rule "name=d'un fournisseur"`,
  'npx ddd-ts-kit lint --rule "amount=a > b; c"',
  'nice npx ddd-ts-kit lint --rule "a > src/main.ts"',
  `npm exec -- ddd-ts-kit lint --rule 'rm src/main.ts; "'`,
];

// What the command behind a runner runs itself is still read: a shell, a wrapper, a runner, `find`.
const BEHIND_A_RUNNER = [
  ["npx sh -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ["npx env -S 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['npx npx nice rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx find src -name "*.orig" -exec rm {} +', /`rm` changes files under src/],
  ['npx npx npx npx npx npx npx rm src/main.ts', /nested deeper/],
];

// A runner asked to run its command through a shell (`-c`, `--call`, `--shell-mode`, among its own
// options, before or after `exec`) hands it a text: that text is read as a command line.
const RUNNER_SHELL_TEXT = [
  ['pnpm exec -c "echo x > src/main.ts"', /the redirection `> src\/main\.ts`/],
  ['pnpm exec --shell-mode "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['pnpm dlx -c "cowsay hi; rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['pnpm dlx --shell-mode "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['pnpm -c exec "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['pnpm --shell-mode dlx "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['pnpm --filter api exec -c "rm src/main.ts"', /`rm` changes files only the shell knows/],
  ['pnpm exec -c rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx --call="rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npx -y -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npm exec -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npm exec --call="rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npm x -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npm --silent exec -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['bun x sh -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['bunx sh -c "rm src/main.ts"', /`rm` changes src\/main\.ts/],
  ['npx -w api sh -c "rm src/main.ts"', /`rm` changes files only the shell knows/],
  ['npx --workspace api rm src/main.ts', /`rm` changes files only the shell knows/],
  ['pnpm --filter api exec rm src/main.ts', /`rm` changes files only the shell knows/],
  ['yarn exec rm src/main.ts', /`rm` changes src\/main\.ts/],
];

// Without it, the words stay words, and an option after the command is the command's own.
const RUNNER_PLAIN = [
  'pnpm exec ddd-ts-kit lint --rule "a > src/main.ts"',
  'pnpm dlx ddd-ts-kit lint --rule "rm src/main.ts; x"',
  'pnpm exec ddd-ts-kit lint -c "rm src/main.ts"',
  'pnpm install',
  'npm --version',
  'bun --version',
];

test('a package runner asked for a shell is read as the text it hands to it, on every runner', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of RUNNER_SHELL_TEXT) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const command of RUNNER_PLAIN) {
    const refused = run('pre-bash', bash(root, command, agent)).output;
    assert.doesNotMatch(JSON.stringify(refused ?? ''), /src\/main\.ts/, command);
  }
});

// Whatever the guard cannot prove hands no text to a shell is read as text, every word of it: an
// option it does not know, a bundle of short options, an option repeated, an abbreviation, a program
// whose name is no plain name, yarn and bun in the forms that run a script, a setting of the runner
// given by the environment.
const RUNNER_UNPROVEN = [
  "npx -yc 'echo x > src/main.ts'",
  "npx --cal 'echo x > src/main.ts'",
  "npx --ca='echo x > src/main.ts'",
  "npx -- -c 'rm src/main.ts'",
  "npx --loglevel silent -c 'rm src/main.ts'",
  "npx --userconfig /x -c 'rm src/main.ts'",
  "npx --call=true --call 'rm src/main.ts'",
  "npx -c true -c 'rm src/main.ts'",
  "npx -y --package 'rm src/main.ts'",
  "npx 'rm src/main.ts'",
  'npx "echo x > src/main.ts"',
  "npm exec -yc 'rm src/main.ts'",
  "npm exe -c 'rm src/main.ts'",
  "npm ex -c 'rm src/main.ts'",
  'npm exe rm src/main.ts',
  "npm --loglevel silent exec -c 'rm src/main.ts'",
  "npm exec --loglevel silent -c 'rm src/main.ts'",
  "npm exec --cal 'rm src/main.ts'",
  "pnpm exec -rc 'rm src/main.ts'",
  "pnpm -rc exec 'rm src/main.ts'",
  "pnpm --reporter silent exec -c 'rm src/main.ts'",
  "pnpm --shell-mod exec 'rm src/main.ts'",
  "pnpm --config.shell-mode=true exec 'rm src/main.ts'",
  "pnpm --loglevel silent -c exec 'rm src/main.ts'",
  "yarn exec 'rm src/main.ts'",
  'yarn rm src/main.ts',
  'yarn workspace api exec rm src/main.ts',
  "bun exec 'rm src/main.ts'",
  'bun run rm src/main.ts',
  'bun -c bunfig.toml x rm src/main.ts',
  "npm_config_call='rm src/main.ts' npx",
  "export npm_config_call='rm src/main.ts' && npx",
  "npm_config_shell_mode=true pnpm exec 'rm src/main.ts'",
  "export NPM_CONFIG_SHELL_MODE=true; pnpm exec 'rm src/main.ts'",
  "export npm_config_call=x; npx ddd-ts-kit lint --rule 'rm src/main.ts'",
];

test('a package runner the guard cannot prove hands no text to a shell is read as text, every word of it', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of RUNNER_UNPROVEN) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /src\/main\.ts|`ex` changes/, command);
  }
  // A manager asked for none of its runners runs no command of the line.
  for (const command of ['npm install', 'pnpm install --frozen-lockfile', 'npx']) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

// npm reads `true` or `false` after one of its options that take none as the value of that option:
// the word after it is the program, so the shape is not the one the guard reads in full.
const RUNNER_SWALLOWED = [
  ["npm exec -y false -- sh -c 'echo x > src/main.ts'", /the redirection `> src\/main\.ts`/],
  ["npm exec --yes true -- sh -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['npm exec --no false rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx --no false rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx --no true tee src/main.ts', /`tee` writing src\/main\.ts/],
  ['npx -y true rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx -q false rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['npx --no false ddd-ts-kit generate value-object ordering Money', /writes in another context/],
  ['npx --no true biome format --write .', /biome/],
  ['pnpm -r false exec rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['bunx --bun true rm src/main.ts', /`rm` changes src\/main\.ts/],
];

test('a word true or false after an option of a runner that takes none is read as its value, not as the program', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of RUNNER_SWALLOWED) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
});

// A wrapper is read through only when the guard knows it and every option it is given: any other
// first word that is no program the guard knows, or a wrapper with an option it does not know, may
// run the words after it, and each word that may start a command is read as one.
const BEHIND_ANY_WRAPPER = [
  'time -p rm src/main.ts',
  'time -- rm src/main.ts',
  'time -o /dev/null rm src/main.ts',
  '/usr/bin/time -p rm src/main.ts',
  'command time -p rm src/main.ts',
  'strace -f rm src/main.ts',
  'strace -o /dev/null rm src/main.ts',
  'ltrace rm src/main.ts',
  'fakeroot rm src/main.ts',
  'setarch x86_64 rm src/main.ts',
  'unshare -r rm src/main.ts',
  'chroot / rm src/main.ts',
  'xvfb-run -a rm src/main.ts',
  'ionice -c 3 -t rm src/main.ts',
  'stdbuf -oL rm src/main.ts',
  'nice -19 rm src/main.ts',
  'timeout --kill-after=1 5 rm src/main.ts',
  'setsid -w rm src/main.ts',
  'nohup -- rm src/main.ts > /dev/null',
  'doas -n rm src/main.ts',
  'watch -x rm src/main.ts',
  'env -u NAME rm src/main.ts',
  'env --unset=NAME rm src/main.ts',
  'chrt -f 1 rm src/main.ts',
  'taskset -c 0 rm src/main.ts',
  'flock -n /dev/null rm src/main.ts',
  'a-tool-of-the-project rm src/main.ts',
  './scripts/run.sh rm src/main.ts',
  'npx time -p rm src/main.ts',
  "time -p sh -c 'rm src/main.ts'",
  'time -p npx rm src/main.ts',
];

// What is no command is not read as one: the arguments of a program the guard knows, a quoted
// word, a word the shell computes, the words of a loop.
const NO_COMMAND = [
  'echo rm src/main.ts',
  'printf "%s" rm src/main.ts',
  'grep -rn rm src/main.ts',
  'a-tool-of-the-project "rm src/main.ts"',
  'a-tool-of-the-project --out "$HOME" --name NAME=value',
  'for word in rm tee; do echo "$word"; done',
  'docker ps -a',
  'time -p ls src',
  'nice -n 5 ls src',
];

test('a wrapper is read through, with whatever options, down to the command it runs', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of BEHIND_ANY_WRAPPER) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /`rm` changes src\/main\.ts/, command);
  }
  for (const command of NO_COMMAND) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('pnpm given a program by its bare name runs it as pnpm exec does', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of [
    ['pnpm tee src/main.ts', /`tee` writing src\/main\.ts/],
    ["pnpm sh -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
    ['pnpm -r tee src/main.ts', /`tee` writing src\/main\.ts/],
    ['pnpm --reporter silent tee src/main.ts', /`tee` writing src\/main\.ts/],
  ]) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const command of ['pnpm install', 'pnpm run build', 'pnpm test', 'pnpm ls --depth 0']) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('the words of the command behind a package runner are read as the shell split them', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of RUNNER_WORDS) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  for (const [command, expected] of BEHIND_A_RUNNER) {
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
  const outside = run('pre-bash', bash(root, 'rm /**/.cache src/main.ts', agent));
  assert.equal(decision(outside), 'deny');
  assert.match(reason(outside), /changes \/\*\*\/\.cache/, 'the pattern as written, not walked');
  assert.ok(Date.now() - started < 20_000, 'answered without walking the disk');
  const wrapped = run('pre-bash', bash(root, `${'nice '.repeat(40)}rm src/main.ts`, agent));
  assert.equal(decision(wrapped), 'deny');
  assert.match(reason(wrapped), /name only the shell knows/);
  assert.equal(run('pre-bash', bash(root, `${'nice '.repeat(3)}ls`, agent)).output, undefined);
});

test('a worker sets none of the variables by which the shell or git find their places', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'TMPDIR=. ; echo x > $TMPDIR/src/main.ts',
    'HOME=. ; echo x > ~/src/main.ts',
    'CDPATH=../.. cd src/contexts/ordering >/dev/null && touch x.ts',
    'GIT_DIR=../other/.git git status',
    'GIT_WORK_TREE=.. git checkout -- .',
    'export PATH=./bin:$PATH; ls',
  ]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /sets no/, command);
  }
  assert.equal(run('pre-bash', bash(root, 'NODE_ENV=test ls', agent)).output, undefined);
});

test('a cd that CDPATH sends elsewhere leaves the place of what follows to the shell', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'cdpath', agent_id: 'worker' };
  mkdirSync(join(conductor, 'src/contexts/billing'), { recursive: true });
  mkdirSync(join(worktree, 'src/contexts/billing'), { recursive: true });
  const command = 'cd src/contexts/billing && touch invoice.ts';
  assert.equal(run('pre-bash', bash(worktree, command, agent)).output, undefined);
  const elsewhere = run('pre-bash', bash(worktree, command, agent), { CDPATH: conductor });
  assert.equal(decision(elsewhere), 'deny');
});

// A wrapper that writes a file of its own (its report, its log, its lock) writes it as a redirection
// does; one given an option the guard does not know may write anywhere.
const WRAPPER_WRITES = [
  ['command time -o src/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['/usr/bin/time -o src/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['\\time -a -o src/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['time --output=src/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['time -osrc/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['nice time -o src/main.ts true', /`time` writing its output to src\/main\.ts/],
  ['strace -o src/main.ts true', /`strace` writing its output to src\/main\.ts/],
  ['ltrace -o src/main.ts true', /`ltrace` writing its output to src\/main\.ts/],
  ['xvfb-run -e src/main.ts true', /`xvfb-run` writing its output to src\/main\.ts/],
  ['xvfb-run --error-file=src/main.ts true', /`xvfb-run` writing its output to src\/main\.ts/],
  ['flock src/main.ts true', /`flock` writing its output to src\/main\.ts/],
  ['script src/main.ts', /`script` writing its output to src\/main\.ts/],
  ['script -q -O src/main.ts -c true', /`script` writing its output to src\/main\.ts/],
  ['script --log-out=src/main.ts -c true', /`script` writing its output to src\/main\.ts/],
  ['script -c true', /`script` writing its output to typescript/],
  ['nohup true', /`nohup` writing its output to nohup\.out/],
  ['npx nohup true', /`nohup` writing its output to nohup\.out/],
  ['time -o "$REPORT" true', /writes files only the shell knows/],
  ['time -o', /writes files only the shell knows/],
  ['sudo -A true', /`sudo`, .* writes files only the shell knows/],
  ['timeout --unknown 5 true', /`timeout`, .* writes files only the shell knows/],
];

test('a wrapper that writes a file of its own is held to the scope for it, as a redirection is', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'ordering');
  for (const [command, expected] of WRAPPER_WRITES) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const command of [
    'time -o src/contexts/ordering/time.log true',
    'time -o /dev/null true',
    'time -p true',
    'nohup true > /dev/null',
    'nohup true >> src/contexts/ordering/run.log 2>&1',
    'flock /dev/null true',
    'script -q -c true /dev/null',
    'stdbuf -oL true',
    'nice -19 true',
    'timeout -s9 5 true',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('the root of the context of a worker is inside its scope, for a tool that writes under it', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'ordering');
  for (const command of [
    'npx --no eslint src/contexts/ordering --fix',
    'npx --no eslint src/contexts/ordering/ --fix',
    'npx --no eslint --fix test/e2e/support/ordering',
    'touch src/contexts/ordering',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  for (const command of [
    'npx --no eslint src/contexts --fix',
    'npx --no eslint src/contexts/billing --fix',
    'npx --no eslint src/contexts/ordering-archive --fix',
    'npx --no eslint test/e2e/support --fix',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
  }
});
