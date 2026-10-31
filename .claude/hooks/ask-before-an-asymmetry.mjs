#!/usr/bin/env node
// A PreToolUse hook of Claude Code in this repository: an edit of a registry of asymmetries
// (`pipeline/monorepo/families.mjs`, `packages/cli/test/support/support-matrix.ts`) is asked to
// the maintainer, whatever the permission mode. A line there turns a failing parity or support
// check green; it must be a decision of a person, never the shortest way to a green pipeline.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REGISTRIES = ['pipeline/monorepo/families.mjs', 'packages/cli/test/support/support-matrix.ts'];

/** The registry a tool call writes to, or `undefined`. */
export function registryTouched(call) {
  const input = call?.tool_input ?? {};
  const target = [input.file_path, input.path, input.notebook_path].find((value) => typeof value === 'string');

  if (target !== undefined) {
    return REGISTRIES.find((registry) => target.replaceAll('\\', '/').endsWith(registry));
  }

  const command = typeof input.command === 'string' ? input.command : '';
  const named = REGISTRIES.find((registry) => command.includes(registry.split('/').at(-1) ?? registry));

  // A command that names a registry anywhere asks, unless every command of its pipeline only reads:
  // the readers are fewer than the ways to write a file.
  return named !== undefined && !segmentsOf(command).every(reads) ? named : undefined;
}

export function decisionFor(call) {
  const registry = registryTouched(call);

  if (registry === undefined) {
    return undefined;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `${registry} records the asymmetries the checks let through. Fill the gap instead when it can be filled; ` +
        'a line here is the decision of the maintainer, with a reason that holds.',
    },
  };
}

/** The programs that only read what they are given. */
const READERS = new Set([
  ...['cat', 'head', 'tail', 'less', 'more', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'ls', 'stat', 'file', 'diff'],
  ...['nl', 'bat', 'sha256sum', 'md5sum', 'cd', 'echo'],
]);

/** The subcommands of git that only read, or only stage. */
const GIT_READERS = new Set(['diff', 'log', 'show', 'blame', 'status', 'ls-files', 'grep', 'check-ignore', 'add']);

/** The tools that check a file and write it only when asked to. */
const CHECKERS = new Set(['biome', 'prettier', 'eslint']);

/** What comes before the program: variable assignments, `nice` with its niceness, `time`, `command`, `env`, `sudo`. */
const PREFIX = /^\s*(?:\w+=\S*|nice(?:\s+-n\s*\d+)?|time|command|env|sudo|npx|pnpm\s+exec)\s+/;

/** The flags that make a program write a file: an output file, in place (sed and awk), a fix (the checkers). */
const OUTPUT_FLAG = /^(?:--output.*|-o)$/;
const IN_PLACE_FLAG = /^(?:-[a-zA-Z]*i|--in-place.*|inplace)$/;
const FIX_FLAG = /^(?:--write|-w|--fix|--apply|--fix-.*)$/;

/** The searchers, for which `-o` only prints the match. */
const SEARCHERS = new Set(['grep', 'egrep', 'fgrep', 'rg']);

/** A `w` or `e` flag or command of a sed script writes a file or runs a command. */
const WRITING_SCRIPT = /(?:\/[\w]*[we]|(?:^|[\s;{}])w)(?:\s|$|['";}])/;

/** The simple commands of a pipeline or a list, cut at the operators that are not inside quotes. */
function segmentsOf(command) {
  const masked = maskedQuotes(command);
  const cuts = [...masked.matchAll(/&&|\|\||;|\||\n|\$\(|`/g)];
  const bounds = [0, ...cuts.flatMap((cut) => [cut.index, cut.index + cut[0].length]), command.length];

  return bounds
    .flatMap((bound, index) => (index % 2 === 0 ? [[bound, bounds[index + 1]]] : []))
    .map(([from, to]) => ({ text: command.slice(from, to), masked: masked.slice(from, to) }));
}

/** The command with the inside of every quoted string blanked out, so that its operators can be seen. */
function maskedQuotes(command) {
  const blank = (quoted) => quoted[0] + 'Q'.repeat(quoted.length - 2) + quoted[0];

  return command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, blank);
}

/** Whether one simple command only reads: a known reader or checker, read-only git, no writing flag, no redirection. */
function reads({ text, masked }) {
  const quiet = masked.replace(/\d*>&\d+|\d*>\s*\/dev\/null/g, ' ');
  const [program, ...rest] = words(withoutPrefixes(text));

  if (quiet.includes('>') || writesByFlag(program, rest)) {
    return false;
  }

  if (program === undefined) {
    return true;
  }

  if (program === 'sed' || program === 'awk' || program === 'gawk') {
    return !(program === 'sed' && rest.some((word) => WRITING_SCRIPT.test(word.replaceAll(/^['"]|['"]$/g, ''))));
  }

  if (program === 'node') {
    return rest.includes('--check') || rest.includes('-c');
  }

  return program === 'git' ? GIT_READERS.has(gitSubcommand(rest)) : READERS.has(program) || CHECKERS.has(program);
}

function writesByFlag(program, rest) {
  const flags = new Set(
    [
      [OUTPUT_FLAG, !SEARCHERS.has(program)],
      [IN_PLACE_FLAG, program === 'sed' || program === 'awk' || program === 'gawk'],
      [FIX_FLAG, CHECKERS.has(program)],
    ].flatMap(([flag, applies]) => (applies ? rest.filter((word) => flag.test(word)) : [])),
  );

  return flags.size > 0;
}

/** The subcommand of git: the first word that is no option nor the value of `-C` or `-c`. */
function gitSubcommand(rest) {
  const skipped = rest.findIndex((word, index) => !word.startsWith('-') && !['-C', '-c'].includes(rest[index - 1]));

  return rest[skipped] ?? '';
}

function words(segment) {
  return segment
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
}

function withoutPrefixes(segment) {
  return PREFIX.test(segment) ? withoutPrefixes(segment.replace(PREFIX, '')) : segment;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const decision = decisionFor(JSON.parse(readFileSync(0, 'utf8') || '{}'));

  if (decision !== undefined) {
    process.stdout.write(JSON.stringify(decision));
  }
}
