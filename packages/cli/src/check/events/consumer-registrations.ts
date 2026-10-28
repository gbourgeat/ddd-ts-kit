import type { SourceFile } from '../model/source-file';
import type { StringRecord } from '../scan/string-record';
import { chainEnd } from '../text/chain-end';
import { escapeRegExp } from '../text/escape-reg-exp';
import { matchingBracket } from '../text/matching-bracket';

const CALL = /(?:(\.)\s*|(?<![\w$.]))(on|consume|idempotent)\s*(?:<[^<>()]*>)?\s*\(/g;
const CONSUMER_KEY = /(?<![\w$.])consumer\s*:\s*$/;
const CONSUMER_OPTION = /(?<![\w$.])consumer\s*[:,}]/;
const STORE_OPTION = /(?<![\w$.])processed\s*[:,}]/;
const SPREAD = /\.\.\.\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g;
const OPTIONS_TYPE = /^(?:Readonly\s*<\s*)?ConsumeOptions\b|^Omit\s*<\s*ConsumeOptions\s*,([^>]*)>/;

export interface ConsumerRegistration {
  /** Blanked code of the call and of the calls chained on it. */
  readonly code: string;
  readonly line: number;
  /** The consumer name, when it is written as a literal. */
  readonly name: string | undefined;
  readonly nameLine: number;
  /** False for a free `on` or `consume` that is given no processed-event store. */
  readonly deduplicates: boolean;
  /** True when the options spread an object whose content this file does not show, and nothing else gives `processed`. */
  readonly spreadsUnreadable: boolean;
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

    if (literal === undefined && (match[2] === 'idempotent' || !CONSUMER_OPTION.test(registered))) {
      return [];
    }

    const line = file.scan.lineAt(span.start);
    const given = match[1] !== undefined || match[2] === 'idempotent' || STORE_OPTION.test(registered);
    const spreads = [...registered.matchAll(SPREAD)].map((spread) => spread[1] ?? '');
    const readFromSpread = !given && spreads.some((name) => spreadCarriesStore(file, name));
    const deduplicates = given || readFromSpread;
    const spreadsUnreadable = !deduplicates && spreads.length > 0;

    return [
      {
        code: registered,
        line,
        name: literal?.value,
        nameLine: literal?.line ?? line,
        deduplicates,
        spreadsUnreadable,
      },
    ];
  });
}

function firstLiteral(file: SourceFile, { open, end }: Span): StringRecord | undefined {
  return file.scan.strings.find(
    (literal) =>
      literal.start >= open && literal.start < end && file.scan.code.slice(open, literal.start).trim() === '',
  );
}

function optionLiteral(file: SourceFile, { open, end }: Span): StringRecord | undefined {
  const { code, strings } = file.scan;

  return strings.find(
    (literal) =>
      literal.start > open &&
      literal.start < end &&
      CONSUMER_KEY.test(code.slice(Math.max(open, literal.start - 40), literal.start)),
  );
}

/**
 * Whether the object spread under `name` shows `processed` in this file: a `const` initialised with an
 * object literal that carries it, or a `const` or a parameter typed with `ConsumeOptions`.
 */
function spreadCarriesStore(file: SourceFile, name: string): boolean {
  const { code } = file.scan;
  const word = escapeRegExp(name);

  const initialised = new RegExp(`\\b(?:const|let)\\s+${word}\\s*(?::[^=]*)?=\\s*\\{`).exec(code);

  if (initialised !== null) {
    const open = initialised.index + initialised[0].length - 1;

    if (STORE_OPTION.test(code.slice(open, matchingBracket(code, open) + 1))) {
      return true;
    }
  }

  const typed = new RegExp(`(?<![\\w$.])${word}\\s*\\??:\\s*`, 'g');

  return [...code.matchAll(typed)].some((declared) => {
    const start = declared.index + declared[0].length;
    const type = OPTIONS_TYPE.exec(file.text.slice(start, start + 120));

    return type !== null && !/\bprocessed\b/.test(type[1] ?? '');
  });
}
