#!/usr/bin/env node
// A PreToolUse hook of Claude Code in this repository: an edit of a registry of asymmetries
// (`pipeline/monorepo/families.mjs`, `packages/cli/test/support/support-matrix.ts`) is asked to
// the maintainer, whatever the permission mode. A line there turns a failing parity or support
// check green; it must be a decision of a person, never the shortest way to a green pipeline.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The programs that only read what they are given. */
const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'ls', 'stat', 'file', 'diff', 'nl', 'bat', 'sha256sum', 'md5sum']);

/** The subcommands of git that only read, or only stage. */
const GIT_READERS = new Set(['diff', 'log', 'show', 'blame', 'status', 'ls-files', 'grep', 'check-ignore', 'add']);

/** What comes before the program: variable assignments, `nice` with its niceness, `time`, `command`, `env`, `sudo`. */
const PREFIX = /^\s*(?:\w+=\S*|nice(?:\s+-n\s*\d+)?|time|command|env|sudo)\s+/;

export const REGISTRIES = ['pipeline/monorepo/families.mjs', 'packages/cli/test/support/support-matrix.ts'];

/** The registry a tool call writes to, or `undefined`. */
export function registryTouched(call) {
  const input = call?.tool_input ?? {};
  const target = [input.file_path, input.path, input.notebook_path].find((value) => typeof value === 'string');

  if (target !== undefined) {
    return REGISTRIES.find((registry) => target.replaceAll('\\', '/').endsWith(registry));
  }

  const command = typeof input.command === 'string' ? input.command : '';

  const named = (segment, registry) => segment.includes(registry.split('/').at(-1) ?? registry);

  // A command that names a registry asks, unless every simple command that names it is a known reader:
  // the readers are fewer than the ways to write a file.
  return REGISTRIES.find((registry) =>
    command
      .split(/&&|\|\||;|\||\n|\$\(|`/)
      .some((segment) => named(segment, registry) && !reads(segment)),
  );
}

/** Whether one simple command only reads: a known reader, a `sed` without an in-place flag, `node --check`, a read-only git subcommand, no redirection into a file. */
function reads(segment) {
  const withoutQuiet = segment.replace(/\d*>&\d+|\d*>\s*\/dev\/null/g, ' ');

  if (withoutQuiet.includes('>')) {
    return false;
  }

  const [program, ...rest] = words(withoutPrefixes(withoutQuiet));

  if (program === undefined) {
    return true;
  }

  if (program === 'sed' || program === 'awk' || program === 'gawk') {
    return !rest.some((word) => /^-[a-zA-Z]*i/.test(word) || word.startsWith('--in-place') || word === 'inplace');
  }

  if (program === 'node') {
    return rest.includes('--check') || rest.includes('-c');
  }

  if (program === 'git') {
    return GIT_READERS.has(rest.find((word) => !word.startsWith('-') && word !== 'user.name' && !word.includes('=')) ?? '');
  }

  return READERS.has(program);
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

export function decisionFor(call) {
  const registry = registryTouched(call);

  if (registry === undefined) {
    return undefined;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `${registry} records the asymmetries the checks let through. Fill the gap instead when it can be filled; a line here is the decision of the maintainer, with a reason that holds.`,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const decision = decisionFor(JSON.parse(readFileSync(0, 'utf8') || '{}'));

  if (decision !== undefined) {
    process.stdout.write(JSON.stringify(decision));
  }
}
