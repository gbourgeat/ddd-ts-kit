import { CONFIG_FILE, KNOWN_CONFIG_KEYS, KNOWN_STACK_KEYS } from '../../config';
import { nearestOf } from '../../config/values/nearest-of';
import type { Project } from '../model/project';
import type { Report } from '../model/report';
import type { Violation } from '../model/violation';
import { isRecord } from '../support/is-record';
import { lineOf } from '../support/line-of';
import { rawConfig } from './raw-config';

/** A key of the config file nothing reads: the text to place the finding on, and what to say. */
interface UnknownKeyProblem {
  readonly needle: string;
  readonly message: string;
  readonly fix: string;
}

/** The keys of the file, at the root and under `stack`, that the kit does not read: a typo there is a decision lost in silence. */
export function unknownKeys(project: Project, report: Report): Violation[] {
  const raw = rawConfig(project);
  const stack = isRecord(raw['stack']) ? raw['stack'] : {};

  return [
    ...problemsAmong(Object.keys(raw), KNOWN_CONFIG_KEYS, ''),
    ...problemsAmong(Object.keys(stack), KNOWN_STACK_KEYS, 'stack.'),
  ].map(({ needle, message, fix }) =>
    report({ file: CONFIG_FILE, line: lineOf(project.configText, needle) }, message, fix),
  );
}

function problemsAmong(written: readonly string[], known: readonly string[], prefix: string): UnknownKeyProblem[] {
  return written
    .filter((key) => !known.includes(key))
    .map((key) => ({
      needle: `"${key}"`,
      message: `"${prefix}${key}" is not a key of ${CONFIG_FILE}: nothing reads it.`,
      fix: fixFor(prefix, nearestOf(key, known)),
    }));
}

function fixFor(prefix: string, nearest: string | undefined): string {
  return nearest === undefined
    ? 'Remove it, or write the key as docs/CONFIG.md spells it.'
    : `Write "${prefix}${nearest}", the nearest key the kit reads, or remove it.`;
}
