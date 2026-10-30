import { CONFIG_FILE, KNOWN_CONFIG_KEYS, KNOWN_STACK_KEYS } from '../../config';
import { nearestOf } from '../../config/values/nearest-of';
import type { Report } from '../model/report';
import type { Violation } from '../model/violation';
import { isRecord } from '../support/is-record';

/** Where the keys of one object of the file are judged: the known keys, the keys of the other level, how a key is named. */
interface Level {
  readonly known: readonly string[];
  readonly other: readonly string[];
  readonly prefix: '' | 'stack.';
  readonly moveTo: string;
  /** How many objects are open where its keys are written: one at the root, two under `stack`. */
  readonly depth: number;
}

const ROOT: Level = {
  known: KNOWN_CONFIG_KEYS,
  other: KNOWN_STACK_KEYS,
  prefix: '',
  moveTo: 'Move it under "stack": the kit reads it there.',
  depth: 1,
};

const STACK: Level = {
  known: KNOWN_STACK_KEYS,
  other: KNOWN_CONFIG_KEYS,
  prefix: 'stack.',
  moveTo: 'Move it to the root of the file: the kit reads it there.',
  depth: 2,
};

/** A key of the config file nothing reads: the text to place the finding on, and what to say. */
interface UnknownKeyProblem {
  readonly key: string;
  readonly message: string;
  readonly fix: string;
}

/**
 * The keys of the file, at the root and under `stack`, that the kit does not read: a typo there is
 * a decision lost in silence. `$schema` and the `//` keys that carry a comment are left alone.
 */
export function unknownKeys(raw: Record<string, unknown>, text: string, report: Report): Violation[] {
  const stack = isRecord(raw['stack']) ? raw['stack'] : {};
  const from = text.search(/"stack"\s*:/);

  return [
    ...problemsAmong(Object.keys(raw), ROOT).map((problem) => placed(problem, { text, from: 0, level: ROOT }, report)),
    ...problemsAmong(Object.keys(stack), STACK).map((problem) =>
      placed(problem, { text, from: Math.max(from, 0), level: STACK }, report),
    ),
  ];
}

function problemsAmong(written: readonly string[], level: Level): UnknownKeyProblem[] {
  return written
    .filter((key) => !level.known.includes(key) && !isComment(key))
    .map((key) => ({
      key,
      message: `"${level.prefix}${key}" is not a key of ${CONFIG_FILE}: nothing reads it.`,
      fix: fixFor(key, level),
    }));
}

function isComment(key: string): boolean {
  return key === '$schema' || key.startsWith('//');
}

function fixFor(key: string, level: Level): string {
  if (level.other.includes(key)) {
    return level.moveTo;
  }

  const nearest = nearestOf(key, level.known);

  return nearest === undefined
    ? 'Remove it, or write the key as docs/CONFIG.md spells it.'
    : `Write "${level.prefix}${nearest}", the nearest key the kit reads, or remove it.`;
}

/** The finding on the line of its key, searched from where its object starts and at its depth: the same name may be a key of another object or a value. */
function placed(
  { key, message, fix }: UnknownKeyProblem,
  { text, from, level }: { text: string; from: number; level: Level },
  report: Report,
): Violation {
  return report({ file: CONFIG_FILE, line: lineOfKey(text, key, { from, depth: level.depth }) }, message, fix);
}

function lineOfKey(text: string, key: string, { from, depth }: { from: number; depth: number }): number {
  const pattern = new RegExp(`${JSON.stringify(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');

  pattern.lastIndex = from;

  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (depthAt(text, match.index) === depth) {
      return text.slice(0, match.index).split('\n').length;
    }
  }

  return 1;
}

/** How many objects are open at `index`, the braces inside strings not counted. */
function depthAt(text: string, index: number): number {
  let depth = 0;
  let inString = false;

  for (let i = 0; i < index; i += 1) {
    const char = text[i];

    if (inString) {
      inString = char !== '"';
      i += char === '\\' ? 1 : 0;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '}') {
      depth += char === '{' ? 1 : -1;
    }
  }

  return depth;
}
