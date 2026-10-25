#!/usr/bin/env node
// A PreToolUse hook of Claude Code in this repository: an edit of a registry of asymmetries
// (`pipeline/monorepo/families.mjs`, `packages/cli/test/support/support-matrix.ts`) is asked to
// the maintainer, whatever the permission mode. A line there turns a failing parity or support
// check green; it must be a decision of a person, never the shortest way to a green pipeline.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A shell command that may write a file: a redirection, an in-place edit, a script, a copy, a checkout. */
const WRITES =
  /(>|\btee\b|\bsed\s+-i|\bperl\b|\bpython3?\b|\bnode\s+-e|\bmv\b|\bcp\b|\bpatch\b|\bgit\s+(apply|checkout|restore|stash))/;

export const REGISTRIES = ['pipeline/monorepo/families.mjs', 'packages/cli/test/support/support-matrix.ts'];

/** The registry a tool call writes to, or `undefined`. */
export function registryTouched(call) {
  const input = call?.tool_input ?? {};
  const target = [input.file_path, input.path, input.notebook_path].find((value) => typeof value === 'string');

  if (target !== undefined) {
    return REGISTRIES.find((registry) => target.replaceAll('\\', '/').endsWith(registry));
  }

  const command = typeof input.command === 'string' ? input.command : '';

  return WRITES.test(command)
    ? REGISTRIES.find((registry) => command.includes(registry.split('/').at(-1) ?? registry))
    : undefined;
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
