import type { SourceFile } from '../model/source-file.js';
import type { StringRecord } from '../scan/string-record.js';
import { chainEnd } from '../text/chain-end.js';

const CALL = /(?:(\.)\s*|(?<![\w$.]))(on|consume|idempotent)\s*(?:<[^<>()]*>)?\s*\(/g;
const CONSUMER_KEY = /(?<![\w$.])consumer\s*:\s*$/;
const CONSUMER_OPTION = /(?<![\w$.])consumer\s*[:,}]/;
const STORE_OPTION = /(?<![\w$.])processed\s*[:,}]/;

export interface ConsumerRegistration {
  /** Blanked code of the call and of the calls chained on it. */
  readonly code: string;
  readonly line: number;
  /** The consumer name, when it is written as a literal. */
  readonly name: string | undefined;
  readonly nameLine: number;
  /** False for a free `on` or `consume` that is given no processed-event store. */
  readonly deduplicates: boolean;
}

interface Span {
  readonly start: number;
  readonly open: number;
  readonly end: number;
}

/**
 * Calls that subscribe a consumer under a name: `builder.on(definition, { consumer })`,
 * `consume(definition, { consumer, processed, unitOfWork }, handler)`,
 * `on(definition, handler, { consumer, processed })` and `idempotent(name, store, handler)`.
 */
export function consumerRegistrations(file: SourceFile): ConsumerRegistration[] {
  const { code } = file.scan;

  return [...code.matchAll(CALL)].flatMap((match) => {
    const open = match.index + match[0].length;
    const span = { start: match.index, open, end: chainEnd(code, open) };
    const registered = code.slice(span.start, span.end);
    const literal = match[2] === 'idempotent' ? firstLiteral(file, span) : optionLiteral(file, span);

    if (literal === undefined && (match[2] === 'idempotent' || !CONSUMER_OPTION.test(registered))) return [];

    const line = file.scan.lineAt(span.start);
    const deduplicates = match[1] !== undefined || match[2] === 'idempotent' || STORE_OPTION.test(registered);

    return [{ code: registered, line, name: literal?.value, nameLine: literal?.line ?? line, deduplicates }];
  });
}

function firstLiteral(file: SourceFile, { open, end }: Span): StringRecord | undefined {
  return file.scan.strings.find((literal) => literal.start >= open && literal.start < end && file.scan.code.slice(open, literal.start).trim() === '');
}

function optionLiteral(file: SourceFile, { open, end }: Span): StringRecord | undefined {
  const { code, strings } = file.scan;

  return strings.find((literal) => literal.start > open && literal.start < end && CONSUMER_KEY.test(code.slice(Math.max(open, literal.start - 40), literal.start)));
}
