import { CliError } from '../../../cli-error.js';
import type { Name } from '../../../naming/index.js';
import type { CommandInput } from '../job/command-input.js';

/** A field of the payload of a background job, and how the job hands it to its command. */
export interface PayloadField {
  /** `readonly startsAt: string;` */
  readonly declaration: string;
  /** `new Date(payload.startsAt)` */
  readonly argument: string;
  /** `startsAt: '2026-03-02T09:00:00.000Z',`, what its spec enqueues. */
  readonly sample: string;
}

const JSON_TYPES = new Set(['string', 'number', 'boolean', 'undefined', 'null', 'readonly', 'Array', 'ReadonlyArray']);
const LITERAL = /'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?/g;
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const INSTANT = /^Date(?:\s*\|\s*undefined)?$/;
const SAMPLE_INSTANT = "'2026-03-02T09:00:00.000Z'";

/**
 * A parameter of the command becomes a field of the payload, which is plain JSON: a primitive,
 * a literal, a list of them, or an instant carried as its ISO text. Anything else (a value
 * object, an entity) cannot travel and is refused: a command takes primitives and ids.
 */
export function payloadFieldOf(command: Name, input: CommandInput): PayloadField {
  const { name, type, optional } = input;
  const mark = optional ? '?' : '';

  if (type !== undefined && INSTANT.test(type)) {
    const instant = `new Date(payload.${name})`;

    return {
      declaration: `  readonly ${name}${mark}: string;`,
      argument: optional ? `payload.${name} === undefined ? undefined : ${instant}` : instant,
      sample: `${name}: ${SAMPLE_INSTANT},`,
    };
  }

  if (type === undefined || !isPlainJson(type)) {
    throw uncarried(command, input);
  }

  return {
    declaration: `  readonly ${name}${mark}: ${type};`,
    argument: `payload.${name}`,
    sample: `${name}: ${sampleOf(type, name)},`,
  };
}

function isPlainJson(type: string): boolean {
  const identifiers = type.replace(LITERAL, '').match(IDENTIFIER) ?? [];

  return identifiers.every((identifier) => JSON_TYPES.has(identifier));
}

function sampleOf(type: string, name: string): string {
  if (/\[\]|Array</.test(type)) {
    return '[]';
  }

  if (/\bstring\b/.test(type)) {
    return `'${name}-1'`;
  }

  if (/\bnumber\b/.test(type)) {
    return '1';
  }

  return /\bboolean\b/.test(type) ? 'true' : (type.match(LITERAL)?.[0] ?? 'null');
}

function uncarried(command: Name, { name, type }: CommandInput): CliError {
  const written = type === undefined ? name : `${name}: ${type}`;

  return new CliError(
    `The constructor of ${command.pascal}Command takes \`${written}\`, which the payload of a background job cannot carry.`,
    'A payload is plain JSON: strings, numbers, booleans, literals, lists of them, and instants as `Date`. Give the command primitives and ids (its handler builds the value objects), with a written type, then generate the job again.',
  );
}
