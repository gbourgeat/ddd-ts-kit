// Reads a Bash command line as the shell would split it, without running anything: the simple
// commands it holds, nested ones included (`bash -c`, `eval`, `$(...)`, `find -exec`, `xargs`),
// each with its words, its redirections and the directory it runs in. What only the shell knows
// (a variable, the output of a substitution) is the marker UNKNOWN.
import { homedir, tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';

export const UNKNOWN = '\u0000';

const DEPTH = 5;
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
// Words that open or close a compound command: the command, if any, comes after them.
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}', 'time', 'fi', 'done']);
// Commands that run the command written after them, with the options each takes a value for.
const WRAPPERS = {
  sudo: ['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U'],
  env: ['-u', '-C', '-S', '--unset', '--chdir'],
  nice: ['-n', '--adjustment'],
  timeout: ['-s', '-k', '--signal', '--kill-after'],
  stdbuf: ['-i', '-o', '-e'],
  xargs: ['-I', '-n', '-P', '-d', '-L', '-s', '-E', '-a', '--arg-file', '--delimiter', '--max-args', '--max-procs'],
  command: [],
  exec: ['-a'],
  nohup: [],
  builtin: [],
};

/** Every simple command of `text`, the ones it nests included, each with the directory it runs in. */
export function simpleCommands(text, directory, depth = 0) {
  if (depth > DEPTH) {
    return [];
  }
  const { commands, substitutions } = parseShell(text);
  const found = substitutions.flatMap((inner) => simpleCommands(inner, directory, depth + 1));
  let current = directory;
  for (const command of commands) {
    const words = unwrapped(command.words);
    found.push({ ...command, words, directory: current });
    if (commandName(words) === 'cd') {
      current = changedDirectory(words[1], current);
    }
    found.push(...nestedCommands(words, current, depth));
  }

  return found;
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
  for (;;) {
    const name = commandName(rest);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0] ?? '') || KEYWORDS.has(rest[0])) {
      rest = rest.slice(1);
    } else if (name in WRAPPERS) {
      const inner = afterOptions(rest.slice(1), WRAPPERS[name], name === 'timeout');
      rest = name === 'xargs' && inner.length > 0 ? [...inner, UNKNOWN] : inner;
    } else {
      return rest;
    }
  }
}

/** The words after the options of a wrapper and its assignments (`env`), and after its duration (`timeout`). */
function afterOptions(words, valued, skipsOne) {
  let index = 0;
  while (index < words.length && (words[index].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]))) {
    index += valued.includes(words[index]) ? 2 : 1;
  }
  return skipsOne && /^\d/.test(words[index] ?? '') ? words.slice(index + 1) : words.slice(index);
}

/** The commands a command runs itself: a shell given `-c`, `eval`, the `-exec` of `find`. */
function nestedCommands(words, directory, depth) {
  const name = commandName(words);
  if (SHELLS.has(name)) {
    const code = words.indexOf('-c');
    return code === -1 || words[code + 1] === undefined ? [] : simpleCommands(words[code + 1], directory, depth + 1);
  }
  if (name === 'eval') {
    return simpleCommands(words.slice(1).join(' '), directory, depth + 1);
  }

  return name === 'find' ? findExecutions(words, directory) : [];
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
        executions.push({ words: unwrapped(found), redirects: [], heredoc: false, piped: false, directory });
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
  const state = { text, index: 0, commands: [], substitutions: [], heredocs: [], word: undefined, redirect: undefined };
  state.command = newCommand(false);
  while (state.index < text.length) {
    readNext(state);
  }
  endCommand(state, false);

  return {
    commands: state.commands.filter((command) => command.words.length > 0 || command.redirects.length > 0),
    substitutions: state.substitutions,
  };
}

function newCommand(piped) {
  return { words: [], redirects: [], heredoc: false, piped };
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
    return append(state, text.slice(index + 1, end));
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
    endCommand(state, false);
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
    const double = (char === '&' || char === '|' || char === ';') && (next === char || (char === '|' && next === '&'));
    state.index += double ? 2 : 1;
    return endCommand(state, char === '|' && next !== '|');
  }
  state.index += 1;
  return append(state, char);
}

function append(state, text) {
  state.word = (state.word ?? '') + text;
}

function closingQuote(text, index) {
  const end = text.indexOf("'", index + 1);
  return end === -1 ? text.length : end;
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
      state.substitutions.push(substitutionBody(text, index, end));
      value += UNKNOWN;
      index = end + 1;
    } else {
      value += text[index];
      index += 1;
    }
  }
  state.index = index + 1;
  append(state, value);
}

function readSubstitution(state) {
  const { text, index } = state;
  const end = substitutionEnd(text, index);
  state.substitutions.push(substitutionBody(text, index, end));
  state.index = end + 1;
  append(state, UNKNOWN);
}

/** The index of the character that closes the substitution opened at `index`: a backquote, or the matching parenthesis. */
function substitutionEnd(text, index) {
  if (text[index] === '`') {
    const end = text.indexOf('`', index + 1);
    return end === -1 ? text.length : end;
  }
  let depth = 0;
  for (let at = index + 1; at < text.length; at += 1) {
    if (text[at] === "'") {
      at = closingQuote(text, at);
    } else if (text[at] === '(') {
      depth += 1;
    } else if (text[at] === ')' && --depth === 0) {
      return at;
    }
  }
  return text.length;
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

function endCommand(state, piped) {
  endWord(state);
  state.commands.push(state.command);
  state.command = newCommand(piped);
}

/** After the newline that ends a line, the bodies of its here-documents, each up to its delimiter line. */
function skipHeredocBodies(state) {
  state.index += 1;
  for (const { delimiter, tabs } of state.heredocs.splice(0)) {
    while (state.index < state.text.length) {
      const end = state.text.indexOf('\n', state.index);
      const line = state.text.slice(state.index, end === -1 ? undefined : end);
      state.index = end === -1 ? state.text.length : end + 1;
      if ((tabs ? line.replace(/^\t+/, '') : line) === delimiter) {
        break;
      }
    }
  }
}
