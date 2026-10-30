// Reads a Bash command line as the shell would split it, without running anything: the simple
// commands it holds, nested ones included (`bash -c`, `eval`, `$(...)`, `find -exec`, `xargs`),
// each with its words, its redirections and the directory it runs in. What only the shell knows
// (a variable, the output of a substitution) is the marker UNKNOWN.
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';

export const UNKNOWN = '\u0000';

const DEPTH = 5;
// `$((...))`: its body, between the two parentheses left, holds no separator of commands.
const ARITHMETIC = /^\([^;&|`]*\)$/;
// A here-document opened in a substitution: its delimiter, in either quote or bare; `<<<` opens none.
const HEREDOC = /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|()<>'"]+))/;
export const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
// The options of a shell that take a value (`-o errexit`, `-O extglob`, `--rcfile <file>`).
const SHELL_VALUED = new Set(['-o', '+o', '-O', '+O', '--rcfile', '--init-file']);
// Words that open or close a compound command: the command, if any, comes after them. `coproc`
// starts a command in the background, its name after it.
const KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'do',
  'while',
  'until',
  '!',
  '{',
  '}',
  'time',
  'fi',
  'done',
  'coproc',
]);
// Commands that run the command written after them: `valued` are the options that take a value,
// `skip` consumes one leading operand after the options (`number`, only a duration; `operand`,
// any one word), and `tail` marks what `xargs` builds from standard input.
const WRAPPERS = {
  sudo: { valued: ['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U'] },
  env: { valued: ['-u', '-C', '--unset', '--chdir'] },
  nice: { valued: ['-n', '--adjustment'] },
  timeout: { valued: ['-s', '-k', '--signal', '--kill-after'], skip: 'number' },
  stdbuf: { valued: ['-i', '-o', '-e'] },
  xargs: {
    valued: ['-I', '-n', '-P', '-d', '-L', '-s', '-E', '-a', '--arg-file', '--delimiter', '--max-args', '--max-procs'],
    tail: 'unknown',
  },
  command: { valued: [] },
  exec: { valued: ['-a'] },
  nohup: { valued: [] },
  builtin: { valued: [] },
  ionice: { valued: ['-c', '-n', '-p', '-P', '-u'] },
  setsid: { valued: [] },
  // `taskset <mask> cmd`, `taskset -c <list> cmd`: one positional word before the command either way.
  taskset: { valued: [], skip: 'operand' },
  chrt: { valued: ['-T', '-P'], skip: 'operand' },
  flock: { valued: ['-w', '--timeout', '-E', '--conflict-exit-code'], skip: 'operand' },
  doas: { valued: ['-u', '-C', '-a'] },
  watch: { valued: ['-n', '--interval'] },
  busybox: { valued: [] },
  toybox: { valued: [] },
  parallel: { valued: ['-j', '--jobs', '-S', '--sshlogin', '--results', '--joblog'] },
};

/** Every simple command of `text`, the ones it nests included, each with the directory it runs in. */
export function simpleCommands(text, directory, depth = 0) {
  if (depth > DEPTH) {
    // Deeper than the reader follows: a marker so the guard refuses it rather than read nothing.
    return [unreadMarker('nested', directory, depth)];
  }
  const { commands, substitutions, open } = parseShell(text);
  const found = substitutions.flatMap((inner) => simpleCommands(inner, directory, depth + 1));
  if (open) {
    // The text ends inside a quote or a here-document: what comes after it was not read as commands.
    found.push(unreadMarker('open', directory, depth));
  }
  let current = directory;
  const stack = [];
  let blocks = 0;
  for (const command of commands) {
    blocks += blockChange(command.words);
    const words = unwrapped(command.words);
    // The variables set for the command alone (`X=1 cmd`, `env X=1 cmd`), which the program reads.
    const assigned = command.words.slice(0, command.words.length - words.length).filter(isAssignment);
    found.push({ ...command, words, assigned, directory: current });
    current = movedTo(command, words, { current, stack, blocks });
    found.push(...nestedCommands(words, current, depth));
    const wrapped = wrappedTextOf(command.words);
    if (wrapped !== undefined) {
      found.push(...simpleCommands(wrapped, current, depth + 1));
    }
  }

  return found;
}

function unreadMarker(truncated, directory, depth) {
  return { words: [], redirects: [], heredoc: false, piped: false, directory, depth, ender: undefined, truncated };
}

/** Where `cd`, `pushd` and `popd` leave the commands after them, `place` holding the directory and the `pushd` stack. */
function movedTo(command, words, place) {
  const name = commandName(words);
  if (!['cd', 'pushd', 'popd'].includes(name)) {
    return place.current;
  }
  const next = movedBy(name, words, place);
  if (!isCertain(command, place.blocks)) {
    return undefined;
  }
  // A `cd` that cannot be seen to land on an existing directory leaves the place to the shell.
  return name === 'cd' && (next === undefined || !existsSync(next)) ? undefined : next;
}

function movedBy(name, words, { current, stack }) {
  const target = words[1];
  if (name === 'cd') {
    return changedDirectory(target, current);
  }
  if (name === 'pushd') {
    stack.push(current);
    // Without a directory, `pushd` swaps or rotates the stack: where it lands only the shell knows.
    return target === undefined || /^[+-]\d+$/.test(target) ? undefined : placeOf(target, current);
  }
  // `popd +N` takes an entry off the stack and stays: which one only the shell knows.
  if (target !== undefined && /^[+-]\d+$/.test(target)) {
    stack.length = 0;
    return current;
  }
  return stack.pop();
}

// A directory change holds only when the command ended on `&&` at the top level: after `;`, `||`,
// `|`, `&`, a newline, inside a subshell, or inside a block (a brace group, the body of a function,
// an `if` or a loop, which may run once, never or later), what the next command runs in only the shell knows.
function isCertain(command, blocks) {
  return command.ender === '&&' && command.depth === 0 && blocks === 0;
}

const OPENING = new Set(['{', 'then', 'do']);
const CLOSING = new Set(['}', 'fi', 'done']);

/** How many blocks the leading keywords of a command open (`{`, `then`, `do`) or close (`}`, `fi`, `done`). */
function blockChange(words) {
  let change = 0;
  for (const word of words) {
    if (OPENING.has(word)) {
      change += 1;
    } else if (CLOSING.has(word)) {
      change -= 1;
    } else if (!KEYWORDS.has(word)) {
      break;
    }
  }
  return change;
}

/** The name of the program a simple command runs: `/usr/bin/sed` is `sed`. */
export function commandName(words) {
  return words.length === 0 ? '' : basename(words[0]);
}

/** The words of `args` that are not options, the values of the `valued` options left out; after `--`, every word. */
export function operands(args, valued = []) {
  const found = [];
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index];
    if (word === '--') {
      found.push(...args.slice(index + 1));
      break;
    }
    if (valued.includes(word)) {
      index += 1;
    } else if (!word.startsWith('-') || word === '-') {
      found.push(word);
    }
  }
  return found;
}

/** The absolute path a word names, from the directory of its command; undefined when only the shell knows it. */
export function placeOf(word, directory) {
  const expanded = expandWord(word, directory);
  return expanded === undefined || directory === undefined ? undefined : resolve(directory, expanded);
}

function expandWord(word, directory) {
  // A brace list or range (`{a,b}`, `{1..3}`) stands for several places only the shell computes.
  if (/\{[^{}]*(?:,|\.\.)[^{}]*\}/.test(word)) {
    return undefined;
  }
  const known = word
    .replace(/^~(?=\/|$)/, homedir())
    .replace(/\$\{?HOME\}?(?![\w])/g, homedir())
    .replace(/\$\{TMPDIR(?::?-[^}]*)?\}|\$TMPDIR(?![\w])/g, process.env.TMPDIR ?? tmpdir())
    .replace(/\$\{?PWD\}?(?![\w])/g, directory ?? UNKNOWN);

  return known.includes('$') || known.includes(UNKNOWN) || known.includes('`') ? undefined : known;
}

function changedDirectory(word, directory) {
  if (word === undefined) {
    return homedir();
  }
  return word === '-' ? undefined : placeOf(word, directory);
}

/** Leading assignments, keywords and wrappers taken off: what is left starts with the program run. */
function unwrapped(words) {
  let rest = words;
  for (let next = unwrapOnce(rest); next !== rest; next = unwrapOnce(rest)) {
    rest = next;
  }
  return rest;
}

/** One leading assignment, keyword or wrapper taken off, or the words themselves when there is none. */
function unwrapOnce(rest) {
  if (isAssignment(rest[0] ?? '') || KEYWORDS.has(rest[0])) {
    return rest.slice(1);
  }
  const name = commandName(rest);
  if (!(name in WRAPPERS)) {
    return rest;
  }
  const inner = afterOptions(rest.slice(1), WRAPPERS[name]);
  return WRAPPERS[name].tail === 'unknown' && inner.length > 0 ? [...inner, UNKNOWN] : inner;
}

function isAssignment(word) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);
}

/** The text a command hands to another to split, read at each layer of its wrappers (`nice npx ...`). */
function wrappedTextOf(words) {
  let rest = words;
  let text = wrappedText(rest);
  while (text === undefined && unwrapOnce(rest) !== rest) {
    rest = unwrapOnce(rest);
    text = wrappedText(rest);
  }
  return text;
}

/** The words after the options of a wrapper, its assignments (`env`), and its leading operand. */
function afterOptions(words, { valued, skip }) {
  let index = 0;
  while (index < words.length && (words[index].startsWith('-') || isAssignment(words[index]))) {
    index += valued.includes(words[index]) ? 2 : 1;
  }
  if (skip === 'number') {
    return /^\d/.test(words[index] ?? '') ? words.slice(index + 1) : words.slice(index);
  }
  return skip === 'operand' ? words.slice(index + 1) : words.slice(index);
}

/** The commands a command runs itself: a shell given `-c`, `eval`, the `-exec` of `find`. */
function nestedCommands(words, directory, depth) {
  const name = commandName(words);
  if (SHELLS.has(name)) {
    const code = shellCode(words);
    return code === undefined ? [] : simpleCommands(code, directory, depth + 1);
  }
  if (name === 'eval') {
    return simpleCommands(words.slice(1).join(' '), directory, depth + 1);
  }

  return name === 'find' ? findExecutions(words, directory) : [];
}

/**
 * The text a shell is given by `-c`, alone or in a combined short flag (`-lc`, `-ec`): its first
 * operand after the options. Without it, the shell runs a script or its input, which the guard
 * cannot read: such a command is checked after it ran.
 */
function shellCode(words) {
  let command = false;
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if (SHELL_VALUED.has(word)) {
      index += 1;
    } else if (word === '--' || word === '-') {
      return command ? words[index + 1] : undefined;
    } else if (/^[-+]./.test(word)) {
      command ||= /^-[a-zA-Z]*c[a-zA-Z]*$/.test(word);
    } else {
      return command ? word : undefined;
    }
  }
  return undefined;
}

// A command another computes from a text the shell alone splits: `su`/`doas`/`script`/`flock` from
// their `-c` or `--command` string, `env -S` from its value, and a package runner (`npx`, `bunx`, `npm exec`, ...) from
// the command it runs. The text is read as its own command line.
function wrappedText(words) {
  const name = commandName(words);
  if (['su', 'doas', 'script', 'flock'].includes(name)) {
    return valueOfFlag(words, '-c') ?? valueOfFlag(words, '--command');
  }
  if (name === 'env') {
    return envSplit(words);
  }
  const inner = runnerCommand(words);
  return inner && inner.length > 0 ? inner.join(' ') : undefined;
}

function valueOfFlag(words, flag) {
  const at = words.indexOf(flag);
  return at === -1 ? undefined : words[at + 1];
}

// `env -S "cmd ..."`, `env --split-string cmd ...` and `env --split-string=cmd ...` hand the whole
// line, split by the shell, as the command to run.
function envSplit(words) {
  const spaced = valueOfFlag(words, '-S') ?? valueOfFlag(words, '--split-string');
  const joined = words.find((word) => /^(?:-S.|--split-string=)/.test(word));
  if (joined !== undefined) {
    return joined.replace(/^(?:-S|--split-string=)/, '');
  }
  return spaced;
}

const RUNNERS = new Set(['npx', 'pnpx', 'bunx']);

// The command a package runner runs: `npx <cmd>`, `bunx <cmd>`, `npm|pnpm|yarn exec|dlx <cmd>`, after their
// options and a leading `--`; for `npx` and `npm exec`, the string of `-c`/`--call` is the command itself.
function runnerCommand(words) {
  const name = commandName(words);
  const sub = ['npm', 'pnpm', 'yarn'].includes(name) && ['exec', 'dlx'].includes(words[1]);
  if (!RUNNERS.has(name) && !sub) {
    return undefined;
  }
  const args = words.slice(sub ? 2 : 1);
  const call = name === 'npx' || name === 'npm' ? leadingCall(args) : undefined;
  return call === undefined ? innerCommand(args, ['-p', '--package']) : [call];
}

// The string of `-c`/`--call` among the runner's own options, before the command it runs: a `-c`
// after the command belongs to that command (`npx eslint -c eslint.config.js`).
function leadingCall(args) {
  for (let index = 0; index < args.length && args[index].startsWith('-') && args[index] !== '--'; index += 1) {
    if (args[index] === '-c' || args[index] === '--call') {
      return args[index + 1];
    }
    index += ['-p', '--package'].includes(args[index]) ? 1 : 0;
  }
  return undefined;
}

function innerCommand(args, valued) {
  let index = 0;
  while (index < args.length && args[index].startsWith('-') && args[index] !== '--') {
    index += valued.includes(args[index]) ? 2 : 1;
  }
  return args[index] === '--' ? args.slice(index + 1) : args.slice(index);
}

/** `find <roots> ... -exec <command> {} ;`: `{}` stands for a file under each root. */
function findExecutions(words, directory) {
  const roots = words.slice(1, firstExpression(words));
  const executions = [];
  words.forEach((word, index) => {
    if (['-exec', '-execdir', '-ok', '-okdir'].includes(word)) {
      const end = words.findIndex((next, after) => after > index && (next === ';' || next === '+'));
      const inner = words.slice(index + 1, end === -1 ? undefined : end);
      for (const root of roots.length > 0 ? roots : ['.']) {
        const found = inner.map((part) => part.replaceAll('{}', `${root}/{}`));
        executions.push({
          words: unwrapped(found),
          redirects: [],
          heredoc: false,
          piped: false,
          directory,
          found: true,
        });
      }
    }
  });
  return executions;
}

/** The index of the first word of the expression of `find`, after its roots. */
export function firstExpression(words) {
  const index = words.findIndex((word, position) => position > 0 && /^[-(!]/.test(word));
  return index === -1 ? words.length : index;
}

/**
 * Splits a command line into simple commands: words with their quotes removed, redirections
 * apart (`>`, `>>`, `&>`, `<`, a here-document), the commands of each `$(...)` and backquotes
 * kept for their own reading. The body of a here-document is data, never read as commands.
 */
function parseShell(text) {
  const state = {
    text,
    index: 0,
    depth: 0,
    commands: [],
    substitutions: [],
    heredocs: [],
    word: undefined,
    redirect: undefined,
    open: false,
  };
  state.command = newCommand(false, 0);
  while (state.index < text.length) {
    readNext(state);
  }
  endCommand(state, false, undefined);

  return {
    commands: state.commands.filter((command) => command.words.length > 0 || command.redirects.length > 0),
    substitutions: state.substitutions,
    open: state.open || state.heredocs.length > 0,
  };
}

function newCommand(piped, depth) {
  return { words: [], redirects: [], heredoc: false, piped, depth, ender: undefined };
}

function readNext(state) {
  const { text, index } = state;
  const char = text[index];
  const next = text[index + 1];
  if (char === '\\') {
    state.index += 2;
    return next === '\n' ? undefined : append(state, next ?? '');
  }
  if (char === "'") {
    const end = closingQuote(text, index);
    state.index = end + 1;
    state.open ||= end === text.length;
    return append(state, text.slice(index + 1, end));
  }
  if (char === '$' && next === "'") {
    return readAnsiQuoted(state);
  }
  if (char === '"') {
    return readDoubleQuoted(state);
  }
  if (char === '`' || (char === '$' && next === '(') || ((char === '<' || char === '>') && next === '(')) {
    return readSubstitution(state);
  }
  return readOperator(state, char, next);
}

function readOperator(state, char, next) {
  if (char === '\n') {
    endCommand(state, false, '\n');
    return skipHeredocBodies(state);
  }
  if (char === ' ' || char === '\t') {
    state.index += 1;
    return endWord(state);
  }
  if (char === '#' && state.word === undefined) {
    const end = state.text.indexOf('\n', state.index);
    state.index = end === -1 ? state.text.length : end;
    return undefined;
  }
  if (char === '>' || char === '<' || (char === '&' && next === '>')) {
    return readRedirect(state);
  }
  if (char === ';' || char === '&' || char === '|' || char === '(' || char === ')') {
    return readSeparator(state, char, next);
  }
  state.index += 1;
  return append(state, char);
}

// An operator between commands: its text becomes the ender of the command it closes, and a
// subshell parenthesis raises or lowers the depth the next command starts at.
function readSeparator(state, char, next) {
  const double = (char === '&' || char === '|' || char === ';') && (next === char || (char === '|' && next === '&'));
  const ender = state.text.slice(state.index, state.index + (double ? 2 : 1));
  state.index += double ? 2 : 1;
  if (char === '(') {
    state.depth += 1;
    return endCommand(state, false, ender);
  }
  if (char === ')') {
    endCommand(state, false, ender);
    state.depth -= 1;
    state.command.depth = state.depth;
    return undefined;
  }
  return endCommand(state, char === '|' && next !== '|', ender);
}

function append(state, text) {
  state.word = (state.word ?? '') + text;
}

function closingQuote(text, index) {
  const end = text.indexOf("'", index + 1);
  return end === -1 ? text.length : end;
}

function readAnsiQuoted(state) {
  const { text, index } = state;
  const end = closingAnsiQuote(text, index);
  const value = text.slice(index + 2, end);
  state.index = end + 1;
  state.open ||= end === text.length;
  append(state, value.includes('\\') ? UNKNOWN : value);
}

// The `'` that closes the `$'` at `index`, where `\'` does not: an escape in it means what only the shell decodes.
function closingAnsiQuote(text, index) {
  for (let at = index + 2; at < text.length; at += 1) {
    if (text[at] === '\\') {
      at += 1;
    } else if (text[at] === "'") {
      return at;
    }
  }
  return text.length;
}

/** Inside double quotes `\` escapes `"`, `\`, `$` and the backquote, and a substitution still runs. */
function readDoubleQuoted(state) {
  const { text } = state;
  let index = state.index + 1;
  let value = '';
  while (index < text.length && text[index] !== '"') {
    if (text[index] === '\\' && '"\\$`\n'.includes(text[index + 1])) {
      value += text[index + 1] === '\n' ? '' : text[index + 1];
      index += 2;
    } else if (text[index] === '`' || (text[index] === '$' && text[index + 1] === '(')) {
      const end = substitutionEnd(text, index);
      keepSubstitution(state, index, end);
      value += UNKNOWN;
      index = end + 1;
    } else {
      value += text[index];
      index += 1;
    }
  }
  state.index = index + 1;
  state.open ||= index >= text.length;
  append(state, value);
}

function readSubstitution(state) {
  const { text, index } = state;
  const end = substitutionEnd(text, index);
  keepSubstitution(state, index, end);
  state.index = end + 1;
  append(state, UNKNOWN);
}

// The commands of a substitution are read apart. `$((...))` runs only what nests in it: its parentheses
// open no subshell, and its `<<` is a shift, not a here-document.
function keepSubstitution(state, index, end) {
  state.open ||= end >= state.text.length;
  state.substitutions.push(...commandTexts(substitutionBody(state.text, index, end)));
}

function commandTexts(body) {
  if (!ARITHMETIC.test(body)) {
    return [body];
  }
  const nested = [];
  for (let at = body.indexOf('$('); at !== -1; at = body.indexOf('$(', substitutionEnd(body, at))) {
    nested.push(...commandTexts(substitutionBody(body, at, substitutionEnd(body, at))));
  }
  return nested;
}

/** The index of the character that closes the substitution opened at `index`: a backquote, or the matching parenthesis. */
function substitutionEnd(text, index) {
  if (text[index] === '`') {
    const end = text.indexOf('`', index + 1);
    return end === -1 ? text.length : end;
  }
  let depth = 0;
  const heredocs = [];
  for (let at = index + 1; at < text.length; at += 1) {
    const char = text[at];
    if (char === '\\') {
      at += 1;
    } else if (char === "'") {
      at = text[at - 1] === '$' ? closingAnsiQuote(text, at - 1) : closingQuote(text, at);
    } else if (char === '"') {
      at = closingDoubleQuote(text, at);
    } else if (char === '`') {
      at = closingBackquote(text, at);
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')' && --depth === 0) {
      return at;
    } else if (char === '<' || char === '\n' || char === '#') {
      at = passedOver({ text, at, heredocs });
    }
  }
  return text.length;
}

// Inside a substitution, what no quote or parenthesis counts in: a comment to the end of its line, the
// text of a here-document from the line after its operator. Answers the index the scan stands on.
function passedOver({ text, at, heredocs }) {
  if (text[at] === '#') {
    return /[\s;&|(]/.test(text[at - 1]) ? lineEnd(text, at) - 1 : at;
  }
  if (text[at] === '\n') {
    return heredocs.length === 0 ? at : heredocBodies(text, at + 1, heredocs.splice(0)).index - 1;
  }
  const opened = HEREDOC.exec(text.slice(at, at + 256));
  if (!opened) {
    return at;
  }
  const [word, dash, single, double, plain] = opened;
  heredocs.push({ delimiter: single ?? double ?? plain, tabs: dash === '-' });
  return at + word.length - 1;
}

function lineEnd(text, index) {
  const end = text.indexOf('\n', index);
  return end === -1 ? text.length : end;
}

// The index of the `"` that closes the one at `index`, a `\"` inside it passed over.
function closingDoubleQuote(text, index) {
  for (let at = index + 1; at < text.length; at += 1) {
    if (text[at] === '\\') {
      at += 1;
    } else if (text[at] === '"') {
      return at;
    }
  }
  return text.length;
}

// The index of the backquote that closes the one at `index`.
function closingBackquote(text, index) {
  const end = text.indexOf('`', index + 1);
  return end === -1 ? text.length : end;
}

function substitutionBody(text, index, end) {
  return text.slice(index + (text[index] === '`' ? 1 : 2), end);
}

/** A redirection and its target; a digit word just before it is the descriptor it applies to. */
function readRedirect(state) {
  if (state.word !== undefined && /^\d+$/.test(state.word)) {
    state.word = undefined;
  }
  endWord(state);
  const operator = /^(?:&>>|&>|>>|>\||>&|>|<<<|<<-|<<|<&|<>|<)/.exec(state.text.slice(state.index))[0];
  state.index += operator.length;
  const duplicated = /^\s*(?:\d+|-)(?=$|[\s;&|)])/.exec(state.text.slice(state.index));
  if ((operator === '>&' || operator === '<&') && duplicated) {
    state.index += duplicated[0].length;
    return undefined;
  }
  state.redirect = operator;
  return undefined;
}

function endWord(state) {
  const { word, redirect, command } = state;
  if (word === undefined) {
    return;
  }
  state.word = undefined;
  if (redirect === undefined) {
    command.words.push(word);
    return;
  }
  state.redirect = undefined;
  command.redirects.push({ operator: redirect, target: word });
  if (redirect === '<<' || redirect === '<<-') {
    command.heredoc = true;
    state.heredocs.push({ delimiter: word, tabs: redirect === '<<-' });
  }
}

function endCommand(state, piped, ender) {
  endWord(state);
  state.command.ender = ender;
  state.commands.push(state.command);
  state.command = newCommand(piped, state.depth);
}

/** After the newline that ends a line, the bodies of its here-documents, each up to its delimiter line. */
function skipHeredocBodies(state) {
  const { index, closed } = heredocBodies(state.text, state.index + 1, state.heredocs.splice(0));
  state.index = index;
  state.open ||= !closed;
}

/** Where the text goes on after the bodies that start at `index`, and whether each found its delimiter line. */
function heredocBodies(text, index, heredocs) {
  let at = index;
  let closed = true;
  for (const { delimiter, tabs } of heredocs) {
    let found = false;
    while (at < text.length && !found) {
      const end = lineEnd(text, at);
      const line = text.slice(at, end);
      at = Math.min(end + 1, text.length);
      found = (tabs ? line.replace(/^\t+/, '') : line) === delimiter;
    }
    closed &&= found;
  }
  return { index: at, closed };
}
