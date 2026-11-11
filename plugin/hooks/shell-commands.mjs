// Reads a Bash command line as the shell would split it, without running anything: the simple
// commands it holds, nested ones included (`bash -c`, `eval`, `$(...)`, `find -exec`, `xargs`),
// each with its words, its redirections and the directory it runs in. What only the shell knows
// (a variable, the output of a substitution) is the marker UNKNOWN.
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';

export const UNKNOWN = '\u0000';

const DEPTH = 5;
// The assignments, keywords and wrappers the reader takes off one command, at most.
const LAYERS = 32;
// `$((...))`: its body, between the two parentheses left, holds no separator of commands.
const ARITHMETIC = /^\([^;&|`]*\)$/;
// A here-document opened in a substitution: its delimiter, in either quote or bare; `<<<` opens none.
const HEREDOC = /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|()<>'"]+))/;
export const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
// The options of a shell that take a value (`-o errexit`, `-O extglob`, `--rcfile <file>`).
const SHELL_VALUED = new Set(['-o', '+o', '-O', '+O', '--rcfile', '--init-file']);
// The redirections that take the standard output of a command.
const OUTPUTS = new Set(['>', '>>', '>|', '&>', '&>>']);
// Words that open or close a compound command: the command, if any, comes after them. `coproc`
// starts a command in the background, its name after it.
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}', 'fi', 'done', 'coproc']);
// Commands that run the command written after them: `valued` are the options that take a value,
// `flags` those that take none, `skip` consumes one leading operand after the options (`number`,
// only a duration; `operand`, any one word), and `tail` marks what `xargs` builds from standard
// input. A wrapper given only these options is read through to its command; given any other, the
// guard cannot tell its value from the command, and reads every word after it as one (`hiddenCommands`).
// A wrapper writes too: the file its `writes` options name, its `lock` file, the file it writes `out`
// to when nothing else takes its output; and its `places` options name where the command runs.
const WRAPPERS = {
  sudo: {
    valued: ['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U', '--chdir'],
    flags: ['-E', '-H', '-n', '-S', '-k', '-b'],
    places: ['-D', '--chdir'],
  },
  env: {
    valued: ['-u', '-C', '--unset', '--chdir', '-S', '--split-string'],
    flags: ['-i', '-', '--ignore-environment'],
    places: ['-C', '--chdir'],
  },
  nice: { valued: ['-n', '--adjustment'], flags: [], numeric: true },
  timeout: {
    valued: ['-s', '-k', '--signal', '--kill-after'],
    flags: ['--preserve-status', '--foreground', '-v', '--verbose'],
    skip: 'number',
  },
  time: {
    valued: ['-o', '-f', '--output', '--format'],
    flags: ['-p', '-v', '-a', '--portability', '--verbose', '--append'],
    writes: ['-o', '--output'],
  },
  strace: {
    valued: ['-o', '-e', '-p', '-s', '-u', '-E', '-P', '-a', '-I', '-b', '-O', '-S', '-U', '-X'],
    flags: [
      '-f',
      '-ff',
      '-c',
      '-C',
      '-q',
      '-r',
      '-t',
      '-tt',
      '-T',
      '-v',
      '-x',
      '-y',
      '-yy',
      '-i',
      '-k',
      '-w',
      '-z',
      '-Z',
    ],
    writes: ['-o'],
  },
  ltrace: {
    valued: ['-o', '-e', '-p', '-s', '-u', '-a', '-l', '-n', '-x', '-D', '-A'],
    flags: ['-f', '-c', '-C', '-i', '-r', '-t', '-tt', '-T', '-S', '-L', '-b'],
    writes: ['-o'],
  },
  'xvfb-run': {
    valued: [
      '-e',
      '--error-file',
      '-f',
      '--auth-file',
      '-n',
      '--server-num',
      '-s',
      '--server-args',
      '-p',
      '-w',
      '--wait',
    ],
    flags: ['-a', '--auto-servernum', '-l', '--listen-tcp'],
    writes: ['-e', '--error-file', '-f', '--auth-file'],
  },
  stdbuf: { valued: ['-i', '-o', '-e'], flags: [] },
  xargs: {
    valued: ['-I', '-n', '-P', '-d', '-L', '-s', '-E', '-a', '--arg-file', '--delimiter', '--max-args', '--max-procs'],
    flags: ['-0', '-r', '-t', '-x', '--null', '--no-run-if-empty', '--verbose'],
    tail: 'unknown',
  },
  command: { valued: [], flags: ['-p'] },
  exec: { valued: ['-a'], flags: ['-c', '-l'] },
  nohup: { valued: [], flags: [], out: 'nohup.out' },
  builtin: { valued: [], flags: [] },
  ionice: { valued: ['-c', '-n', '-p', '-P', '-u'], flags: ['-t'] },
  setsid: { valued: [], flags: ['-w', '-f', '-c', '--wait', '--fork', '--ctty'] },
  // `taskset <mask> cmd`, `taskset -c <list> cmd`: one positional word before the command either way.
  taskset: { valued: [], flags: ['-c', '-a', '--cpu-list', '--all-tasks'], skip: 'operand' },
  chrt: { valued: ['-T', '-P'], flags: ['-f', '-r', '-o', '-b', '-i', '-d', '-R', '-a', '-v'], skip: 'operand' },
  flock: {
    valued: ['-w', '--timeout', '-E', '--conflict-exit-code'],
    flags: ['-s', '-x', '-e', '-n', '-u', '-o', '--shared', '--exclusive', '--nonblock', '--unlock', '--close'],
    skip: 'operand',
    lock: true,
  },
  doas: { valued: ['-u', '-C', '-a'], flags: ['-n'] },
  watch: { valued: ['-n', '--interval'], flags: ['-d', '-t', '-b', '-e', '-g', '-x', '--differences', '--no-title'] },
  busybox: { valued: [], flags: [] },
  toybox: { valued: [], flags: [] },
  parallel: { valued: ['-j', '--jobs', '-S', '--sshlogin', '--results', '--joblog'], flags: ['-k', '--keep-order'] },
};
// `script` records a terminal in the file it is given, `typescript` by default, or in those its logs name.
const SCRIPT = {
  valued: ['-c', '--command', '-E', '--echo', '-o', '--output-limit', '-t', '-m', '--logging-format'],
  flags: ['-a', '-e', '-f', '-q', '--append', '--return', '--flush', '--quiet', '--force'],
  logs: ['-O', '--log-out', '-B', '--log-io', '-T', '--log-timing', '-I', '--log-in'],
};
// The programs told by an option where to run what they run.
const PLACED = {
  make: ['-C', '--directory'],
  cmake: ['--build'],
  npm: ['--prefix'],
  pnpm: ['-C', '--dir'],
  yarn: ['--cwd'],
  bun: ['--cwd'],
};

// The programs read by a table: the wrappers, the shells and the runners here, the words of the
// shell that run nothing by themselves, and those the guard names (`knowPrograms`). Any other first
// word may be a wrapper the guard does not know.
const KNOWN_PROGRAMS = new Set([
  ...['eval', 'su', 'script', 'find', 'export', 'declare', 'typeset', 'local', 'readonly', 'unset', 'set', 'shift'],
  ...['for', 'in', 'case', 'esac', 'select', 'function', 'return', 'exit', 'break', 'continue', 'wait', 'read'],
  ...['[[', ']]', '((', '))', ':', 'sleep', 'kill', 'alias', 'unalias', 'trap', 'type', 'hash', 'umask', 'ulimit'],
  ...['mkdir', 'seq', 'yes', 'sort', 'uniq', 'env', 'printenv', 'id', 'whoami', 'uname', 'hostname', 'xargs'],
  ...['rg', 'ag', 'fd', 'less', 'more', 'bat', 'tree', 'column', 'nl', 'tac', 'xxd', 'od', 'cmp', 'comm'],
]);

// The programs that may start a command hidden behind a wrapper the guard cannot read through: those
// read by a table, here or by the caller. A word that names none of them starts nothing the guard
// could judge.
const STARTERS = new Set(['eval', 'su', 'script', 'find', 'xargs', ...Object.keys(WRAPPERS), ...SHELLS]);

/** Names the programs the caller judges by a table of its own: their arguments are no commands. */
export function knowPrograms(names) {
  for (const name of names) {
    KNOWN_PROGRAMS.add(name);
    STARTERS.add(name);
  }
}

/** Every simple command of `text`, the ones it nests included, each with the directory it runs in. */
export function simpleCommands(text, directory, depth = 0) {
  if (depth === 0) {
    // A setting of a runner given by the environment, anywhere on the line, may ask it for a shell.
    shellAsked = SHELL_SETTING.test(text);
  }
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
    // Where its wrappers send it, and the files they write themselves, as redirections of it.
    const { place, writes } = wrapperEffects(command.words, current, command.redirects);
    found.push({ ...command, words, assigned, directory: place, redirects: [...command.redirects, ...writes] });
    const next = movedTo(command, words, { current, stack, blocks });
    const inside = place === current ? next : place;
    found.push(...nestedCommands(words, inside, depth));
    found.push(...wrappedCommands(command.words, inside, depth));
    found.push(...hiddenCommands(command.words, inside, depth));
    current = next;
  }

  return found;
}

/**
 * The commands a wrapper the guard cannot read through may run: when the first word is no program
 * it knows, or a wrapper it knows given an option it does not, each later word that may name a
 * program is read as a command, with the words after it. They are words the shell already split,
 * not text: a quoted word stays one word.
 */
function hiddenCommands(words, directory, depth) {
  if (depth > DEPTH || readThrough(words)) {
    return [];
  }
  return words.flatMap((word, index) =>
    index > 0 && (STARTERS.has(word) || word in RUNNERS)
      ? commandOfWords(words.slice(index), directory, depth + 1)
      : [],
  );
}

/** Whether every layer of a command is one the guard reads in full, down to a program it knows. */
function readThrough(words) {
  let rest = words;
  for (let layer = 0; layer <= LAYERS; layer += 1) {
    const spec = WRAPPERS[commandName(rest)];
    if (isAssignment(rest[0] ?? '') || KEYWORDS.has(rest[0])) {
      rest = rest.slice(1);
    } else if (spec) {
      rest = afterOptions(rest.slice(1), spec, true);
    } else {
      return rest.length <= 1 || KNOWN_PROGRAMS.has(commandName(rest)) || SHELLS.has(commandName(rest));
    }
    if (rest === undefined) {
      return false;
    }
  }
  return false;
}

/**
 * The commands a command hands to another: texts, each read as its own line, or the words a runner
 * runs. The command line a variable gives `npx` (`npm_config_call=...`) is such a text.
 */
function wrappedCommands(words, directory, depth) {
  const wrapped = wrappedOf(words) ?? {};
  const given = words.flatMap((word) => CALL_SETTING.exec(word)?.slice(1) ?? []);
  // A runner told where to run (`pnpm -C <dir> exec`, `npm --prefix <dir> exec`) runs its command
  // there; told a workspace or a filter, in a place only it knows.
  const moved = wrapped.moved === undefined ? directory : placeOf(wrapped.moved, directory);
  return [
    ...given.flatMap((text) => simpleCommands(text, directory, depth + 1)),
    ...guessed(wrapped.guessed, () => (wrapped.texts ?? []).flatMap((text) => simpleCommands(text, moved, depth + 1))),
    ...(wrapped.words ? runCommands(wrapped.words, moved, depth + 1) : []),
  ];
}

/** Reads `texts` as guesses when they are (`guessing`), for the time of that reading. */
function guessed(guesses, read) {
  guessing += guesses ? 1 : 0;
  const found = read();
  guessing -= guesses ? 1 : 0;
  return found;
}

/**
 * The command a package runner runs, from the words the shell already split: they are not text to
 * split again, so a quote, a `>` or a `;` inside a word stays in it. What that command runs itself
 * (a shell, a wrapper, another runner, `find -exec`) is read as for any command.
 */
function runCommands(inner, directory, depth) {
  const read = commandOfWords(inner, directory, depth);
  return [...read, ...hiddenCommands(inner, read[0].directory, depth)];
}

/** The command `inner` is, with what it nests and what it hands to another, where its wrappers send it. */
function commandOfWords(inner, directory, depth) {
  if (depth > DEPTH) {
    return [unreadMarker('nested', directory, depth)];
  }
  const words = unwrapped(inner);
  const { place, writes } = wrapperEffects(inner, directory, []);
  const command = {
    words,
    assigned: inner.slice(0, inner.length - words.length).filter(isAssignment),
    redirects: writes,
    heredoc: false,
    piped: false,
    directory: place,
  };
  return [command, ...nestedCommands(words, place, depth), ...wrappedCommands(inner, place, depth)];
}

function unreadMarker(truncated, directory, depth) {
  return {
    words: [],
    assigned: [],
    redirects: [],
    heredoc: false,
    piped: false,
    directory,
    depth,
    ender: undefined,
    truncated,
  };
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
  // A `cd` that cannot be seen to land on an existing directory, or that CDPATH sends elsewhere,
  // leaves the place to the shell.
  return name === 'cd' && (next === undefined || !existsSync(next) || sentElsewhere(words[1], next)) ? undefined : next;
}

// A relative directory that a folder of CDPATH holds: the shell goes there, not where it is spelled.
function sentElsewhere(target, next) {
  const folders = (process.env.CDPATH ?? '').split(':').filter(Boolean);
  return (
    !/^(?:\.{0,2}\/|\.{1,2}$)/.test(target ?? '/') &&
    folders.some((folder) => resolve(folder, target) !== next && existsSync(resolve(folder, target)))
  );
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
    .replace(/\$\{?PWD\}?(?![\w])/g, directory ?? UNKNOWN)
    // The runtime directory of the user, where a lock shared by several checkouts lives; unset, only the shell knows.
    .replace(
      /\$\{XDG_RUNTIME_DIR(?::?-[^}]*)?\}|\$XDG_RUNTIME_DIR(?![\w])/g,
      (word) => process.env.XDG_RUNTIME_DIR || word,
    );

  return known.includes('$') || known.includes(UNKNOWN) || known.includes('`') ? undefined : known;
}

function changedDirectory(word, directory) {
  if (word === undefined) {
    return homedir();
  }
  return word === '-' ? undefined : placeOf(word, directory);
}

/**
 * Leading assignments, keywords and wrappers taken off: what is left starts with the program run.
 * Past the layers the reader takes off, the program is one only the shell knows.
 */
function unwrapped(words) {
  let rest = words;
  let next = unwrapOnce(rest);
  for (let layer = 0; next !== rest; layer += 1) {
    if (layer === LAYERS) {
      return [UNKNOWN];
    }
    rest = next;
    next = unwrapOnce(rest);
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
  const inner = afterOptions(rest.slice(1), WRAPPERS[name], false);
  return WRAPPERS[name].tail === 'unknown' && inner.length > 0 ? [...inner, UNKNOWN] : inner;
}

function isAssignment(word) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);
}

/** What a command hands to another to run, read at each layer of its wrappers (`nice npx ...`). */
function wrappedOf(words) {
  let rest = words;
  let wrapped = wrappedBy(rest);
  for (let layer = 0; wrapped === undefined && layer < LAYERS && unwrapOnce(rest) !== rest; layer += 1) {
    rest = unwrapOnce(rest);
    wrapped = wrappedBy(rest);
  }
  return wrapped;
}

/**
 * The words after the options of a wrapper, its assignments (`env`), and its leading operand. When
 * `known` is asked, an option the table does not hold answers undefined: its value, if it takes one,
 * cannot be told from the command.
 */
function afterOptions(words, spec, known) {
  const { index, unknown } = readOptions(words, spec);
  if (known && unknown) {
    return undefined;
  }
  if (spec.skip === 'number') {
    return /^\d/.test(words[index] ?? '') ? words.slice(index + 1) : words.slice(index);
  }
  return spec.skip === 'operand' ? words.slice(index + 1) : words.slice(index);
}

/**
 * The leading options of a wrapper: the `index` after them, the `values` of those that take one
 * (spaced, after `=`, or joined to a short option: `-o file`, `--output=file`, `-ofile`), and whether
 * one of them is `unknown` to the table.
 */
function readOptions(words, { valued, flags, numeric }) {
  const read = { index: 0, values: [], unknown: false };
  while (read.index < words.length && (words[read.index].startsWith('-') || isAssignment(words[read.index]))) {
    const word = words[read.index];
    const [name, ...joined] = word.split('=');
    const short = word.slice(0, 2);
    if (valued.includes(word)) {
      read.values.push([word, words[read.index + 1]]);
      read.index += 1;
    } else if (joined.length > 0 && valued.includes(name)) {
      read.values.push([name, joined.join('=')]);
    } else if (!word.startsWith('--') && word.length > 2 && valued.includes(short)) {
      read.values.push([short, word.slice(2)]);
    } else {
      // `--help` and `--version` run no command; `--` ends the options.
      const plain =
        isAssignment(word) ||
        flags.includes(word) ||
        ['--', '--help', '--version'].includes(word) ||
        (numeric && /^-\d+$/.test(word));
      read.unknown ||= !plain;
    }
    read.index += 1;
  }
  return read;
}

/**
 * What the wrappers of a command do besides running it: the `place` it runs in, when one of them or
 * the program itself is told (`env -C <dir>`, `make -C <dir>`, `npm --prefix <dir> run`), and the
 * files they write themselves, as output redirections of the command (`writes`): the report of
 * `time -o`, the log of `strace -o` or `script`, the lock of `flock`, `nohup.out` when nothing else
 * takes the output. A wrapper given an option the table does not hold may write anywhere.
 */
function wrapperEffects(words, directory, redirects) {
  const effects = { place: directory, writes: [], taken: redirects.some(({ operator }) => OUTPUTS.has(operator)) };
  let rest = words;
  for (let layer = 0; layer < LAYERS; layer += 1) {
    const spec = WRAPPERS[commandName(rest)];
    if (isAssignment(rest[0] ?? '') || KEYWORDS.has(rest[0])) {
      rest = rest.slice(1);
    } else if (spec) {
      rest = afterWrapper(rest, spec, effects);
    } else {
      break;
    }
  }
  const name = commandName(rest);
  if (name === 'script') {
    effects.writes.push(...scriptWrites(rest));
  }
  if (name in PLACED && runnerCommand(rest)?.words === undefined) {
    effects.place = toldPlace(rest.slice(1), PLACED[name], effects.place);
  }
  return { place: effects.place, writes: effects.writes };
}

/** The words after one wrapper, what it writes and where it sends its command noted in `effects`. */
function afterWrapper(rest, spec, effects) {
  const name = commandName(rest);
  const args = rest.slice(1);
  const read = readOptions(args, spec);
  for (const [flag, value] of read.values) {
    if (spec.writes?.includes(flag)) {
      effects.writes.push(writeOf(name, value));
    }
    if (spec.places?.includes(flag)) {
      effects.place = placeOf(value ?? UNKNOWN, effects.place);
    }
  }
  // A text read word by word, for want of knowing which word starts the command, is no command
  // the guard knows to carry these options.
  if (read.unknown && guessing === 0) {
    effects.writes.push(writeOf(name, undefined, true));
  }
  if (spec.lock) {
    effects.writes.push({ ...writeOf(name, args[read.index]), lock: true });
  }
  if (spec.out && !effects.taken) {
    effects.writes.push(writeOf(name, spec.out));
  }
  return afterOptions(args, spec, false);
}

/** The file a wrapper writes, as an output redirection; `unread` when an option it was given is not known. */
function writeOf(wrapper, target, unread) {
  return { operator: '>', target: target ?? UNKNOWN, wrapper, ...(unread ? { unread } : {}) };
}

/** The files `script` records in: those its logs name, and the one it is given or `typescript`. */
function scriptWrites(rest) {
  const read = readOptions(rest.slice(1), { ...SCRIPT, valued: [...SCRIPT.valued, ...SCRIPT.logs] });
  const logs = read.values.filter(([flag]) => SCRIPT.logs.includes(flag));
  const file = rest[read.index + 1];
  const targets = [...logs.map(([, value]) => value), ...(file || logs.length === 0 ? [file ?? 'typescript'] : [])];
  return [
    ...targets.map((target) => writeOf('script', target)),
    ...(read.unknown ? [writeOf('script', undefined, true)] : []),
  ];
}

// The directory one of `options` names among the words, spaced, after `=` or joined (`-C<dir>`), from `place`.
function toldPlace(args, options, place) {
  let told = place;
  args.forEach((word, index) => {
    const option = options.find((name) => word === name || word.startsWith(`${name}=`) || /^-C./.test(word));
    if (option && options.includes(word)) {
      told = placeOf(args[index + 1] ?? UNKNOWN, told);
    } else if (option) {
      told = placeOf(word.startsWith(`${option}=`) ? word.slice(option.length + 1) : word.slice(2), told);
    }
  });
  return told;
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
// their `-c` or `--command` string, `env -S` from its value: `texts`, each read as its own command
// line. The command a package runner runs (`npx`, `bunx`, `npm exec`, ...) is `words` the shell
// already split when the guard can prove the runner hands no text to a shell, and `texts` otherwise.
function wrappedBy(words) {
  const name = commandName(words);
  if (['su', 'doas', 'script', 'flock'].includes(name)) {
    return asText(valueOfFlag(words, '-c') ?? valueOfFlag(words, '--command'));
  }
  return name === 'env' ? asText(envSplit(words)) : runnerCommand(words);
}

function asText(text) {
  return text === undefined ? undefined : { texts: [text] };
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

// Each package runner, as far as the guard can prove what it runs: the subcommands by which it runs
// a command (none: the runner itself runs it), and the only options it may be given before that
// command, the `flags` that take no value, the `valued` ones, and among these the ones that name
// the directory the command runs in (`places`) or a place only the runner knows (`elsewhere`). None
// of them asks for a shell. `yarn` runs scripts and binaries by their bare name, and `bun` scripts:
// `any` of their forms may run one, and only `bun x <command>` is proven. `pnpm` runs a binary by
// its bare name too, unless that name is one of its own `commands`.
const RUNNERS = {
  npx: {
    flags: ['-y', '--yes', '--no', '--no-install', '-q', '--quiet'],
    valued: ['-p', '--package', '-w', '--workspace', '--prefix'],
    places: ['--prefix'],
    elsewhere: ['-w', '--workspace'],
  },
  npm: {
    subs: ['exec', 'x'],
    near: /^exe?$/,
    flags: ['-y', '--yes', '--no', '-q', '--quiet', '--silent'],
    valued: ['-p', '--package', '-w', '--workspace', '--prefix'],
    places: ['--prefix'],
    elsewhere: ['-w', '--workspace'],
  },
  pnpx: { flags: [], valued: ['--package'], places: [], elsewhere: [] },
  pnpm: {
    subs: ['exec', 'dlx'],
    flags: ['-r', '--recursive'],
    valued: ['-F', '--filter', '-C', '--dir', '--package'],
    places: ['-C', '--dir'],
    elsewhere: ['-F', '--filter'],
    commands: new Set([
      ...['add', 'install', 'i', 'update', 'up', 'upgrade', 'remove', 'rm', 'uninstall', 'un', 'link', 'ln', 'unlink'],
      ...['import', 'rebuild', 'rb', 'prune', 'fetch', 'dedupe', 'patch', 'patch-commit', 'patch-remove', 'audit'],
      ...['list', 'ls', 'll', 'la', 'outdated', 'why', 'licenses', 'run', 'run-script', 'test', 't', 'tst', 'start'],
      ...['stop', 'restart', 'create', 'env', 'publish', 'pack', 'server', 'store', 'root', 'bin', 'setup', 'init'],
      ...['config', 'c', 'cache', 'doctor', 'deploy', 'approve-builds', 'self-update', 'help', 'completion'],
      ...['recursive', 'multi', 'm', 'install-test', 'it', 'cat-file', 'cat-index', 'find-hash', 'ignored-builds'],
    ]),
  },
  yarn: { any: true },
  bunx: { flags: ['--bun'], valued: ['-p', '--package'], places: [], elsewhere: [] },
  bun: { any: true, subs: ['x'], flags: ['--bun'], valued: ['--cwd'], places: ['--cwd'], elsewhere: [] },
};
// A program named plainly: no space, no quote, nothing the shell reads.
const PLAIN_PROGRAM = /^[\w@.+:/-]+$/;
// The settings of npm and pnpm, read from the environment, that hand a command to a shell.
const SHELL_SETTING = /p?npm_config_(?:call|shell[_-]mode)/i;
const CALL_SETTING = /^npm_config_call=(.+)$/is;
// The options by which any runner is told where to run its command.
const PLACE_OPTION = /^(?:-C|-F|-w|--dir|--prefix|--cwd|--filter|--workspace)(?:=|$)/;
let shellAsked = false;
// Above zero while the words of an invocation the guard could not read in full are read as texts.
let guessing = 0;

// What a package runner runs. When the invocation has the one shape the guard reads in full (the
// runner, its subcommand, options it knows on either side of it, then a program named plainly and
// its arguments) and nothing on the line can ask the runner for a shell, the command is `words`, as
// the shell split them: a quote, a `>` or a `;` in an argument is text of that argument. Any other
// invocation (a `-c`, `--call` or `--shell-mode`, an option the guard does not know, a bundle of
// short options, `true` or `false` after an option that takes no value, which npm reads as its
// value, an abbreviation of the subcommand, a program that is no plain name) may hand text to a
// shell: every word of it is read as shell text, alone and with the words after it, since any of
// them may be the command line. `moved` is where the command runs when an option says so. A manager
// asked for none of its runners runs no command here.
function runnerCommand(words) {
  const runner = RUNNERS[commandName(words)];
  if (!runner) {
    return undefined;
  }
  const rest = words.slice(1);
  const proven = shellAsked || !runner.flags ? undefined : provenCommand(rest, runner);
  if (proven) {
    return proven;
  }
  const asked = rest.some((word) => runner.subs?.includes(word) || runner.near?.test(word));
  const bare = runner.commands !== undefined && !rest.some((word) => runner.commands.has(word));
  if (!(runner.any || !runner.subs || asked || bare)) {
    return undefined;
  }
  return {
    guessed: true,
    texts: rest.flatMap((word, index) => textsFrom(word, rest.slice(index + 1))),
    ...(rest.some((word) => PLACE_OPTION.test(word)) ? { moved: toldDirectory(rest) } : {}),
  };
}

// Where an invocation the guard does not read in full is told to run: the directory of `-C`, `--dir`,
// `--prefix` or `--cwd`, and a place only the runner knows for a workspace or a filter.
function toldDirectory(rest) {
  const at = rest.findIndex((word) => PLACE_OPTION.test(word));
  const [name, ...joined] = rest[at].split('=');
  const value = joined.length > 0 ? joined.join('=') : rest[at + 1];
  return ['-C', '--dir', '--prefix', '--cwd'].includes(name) && value !== undefined ? value : UNKNOWN;
}

// A word read as the start of a command line, with the words after it; the value an option carries
// after `=` (`--call=...`) may start one too.
function textsFrom(word, after) {
  const value = /^-[^=]*=(.+)$/s.exec(word)?.[1];
  return [word, ...(value === undefined ? [] : [value])].map((start) => [start, ...after].join(' '));
}

function provenCommand(rest, runner) {
  const told = { index: 0, moved: undefined };
  afterKnownOptions(rest, runner, told);
  if (runner.subs?.includes(rest[told.index])) {
    told.index += 1;
    afterKnownOptions(rest, runner, told);
  } else if (runner.subs && (!runner.commands || runner.commands.has(rest[told.index]))) {
    return undefined;
  }
  const inner = rest.slice(rest[told.index] === '--' ? told.index + 1 : told.index);
  return inner.length > 0 && PLAIN_PROGRAM.test(inner[0]) && !inner[0].startsWith('-')
    ? { words: inner, moved: told.moved }
    : undefined;
}

// Moves `told.index` past the options the guard knows, where they tell the runner to run noted in
// `told.moved`; at an option it does not know it stops, and at `true` or `false` after an option
// that takes no value it goes to the end of the words: no program is proven then.
function afterKnownOptions(rest, { flags, valued, places, elsewhere }, told) {
  while (told.index < rest.length && rest[told.index] !== '--') {
    const [flag, ...joined] = rest[told.index].split('=');
    if (flags.includes(rest[told.index])) {
      told.index = ['true', 'false'].includes(rest[told.index + 1]) ? rest.length : told.index + 1;
    } else if (valued.includes(flag)) {
      const value = joined.length > 0 ? joined.join('=') : rest[told.index + 1];
      if (places.includes(flag) || elsewhere.includes(flag)) {
        told.moved = places.includes(flag) && value !== undefined ? value : UNKNOWN;
      }
      told.index += joined.length > 0 ? 1 : 2;
    } else {
      break;
    }
  }
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
        const program = unwrapped(found);
        executions.push({
          words: program,
          assigned: found.slice(0, found.length - program.length).filter(isAssignment),
          redirects: [],
          heredoc: false,
          piped: false,
          directory,
          found: true,
          expression: words.slice(firstExpression(words)),
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
