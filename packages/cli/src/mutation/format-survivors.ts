import type { Survivor } from './survivors';

/** A replacement longer than this is cut: the line of the file says the rest. */
const REPLACEMENT_WIDTH = 60;

/**
 * The survivors, one line each under the title: where, what mutator, what the code became, and
 * whether a test covered the line at all. Each is read as a decision: a test named after the rule,
 * or the mutant left alive and said so.
 */
export function formatSurvivors(found: readonly Survivor[], title: string): string {
  if (found.length === 0) {
    return `${title}: none.`;
  }

  const lines = found.map(
    ({ file, line, mutator, replacement, status }) =>
      `  ${file}:${line}  ${mutator}${status === 'NoCoverage' ? ' (no test covers the line)' : ''}  ${cut(replacement)}`,
  );

  return [`${title} (${found.length}):`, ...lines].join('\n');
}

function cut(replacement: string): string {
  const flat = replacement.replaceAll(/\s+/g, ' ').trim();

  return flat.length > REPLACEMENT_WIDTH ? `${flat.slice(0, REPLACEMENT_WIDTH - 2)}..` : flat;
}
