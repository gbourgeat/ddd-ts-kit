import { errorCodes } from '../check/errors/error-codes.js';
import { scan, type Scan } from '../check/scan/scan.js';
import { callArguments } from '../check/text/call-arguments.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { splitTopLevel } from '../check/text/split-top-level.js';
import type { LegacyError, LegacyParameter } from './legacy-error.js';

const CLASS = /export\s+class\s+([A-Za-z_$][\w$]*)\s+extends\s+DomainError\b/;
const CONSTRUCTOR = /(?<![\w$.])constructor\s*\(/;
const SUPER = /(?<![\w$.])super\s*\(/;
const MODIFIERS = /^(?:(?:public|private|protected|readonly|override)\s+)*/;
const MEMBER = /^\s{2}(?!readonly code\b|constructor\b)[A-Za-z_$#]/m;

interface Origin {
  readonly file: string;
  readonly context: string;
}

/** Reads a class per error: its code, the parameters of its constructor and the message it gives to `super`. Undefined when the file holds none. */
export function readLegacyError(source: string, origin: Origin): LegacyError | undefined {
  const scanned = scan(source);
  const declared = CLASS.exec(scanned.code);
  const [code] = errorCodes(scanned);

  if (declared === null || code === undefined) {
    return undefined;
  }

  const head = { ...origin, className: declared[1] ?? '', code: code.code };
  const open = scanned.code.indexOf('{', declared.index);
  const body = { text: source, scanned, open, close: matchingBracket(scanned.code, open) };

  return { ...head, ...constructorOf(body), ...manualReason(body) };
}

interface Body {
  readonly text: string;
  readonly scanned: Scan;
  readonly open: number;
  readonly close: number;
}

/** A class without a constructor inherits the one of `DomainError`: the caller writes the message. */
function constructorOf({
  text,
  scanned,
  open,
  close,
}: Body): Pick<LegacyError, 'parameters' | 'properties' | 'message'> {
  const { code } = scanned;
  const declared = CONSTRUCTOR.exec(code.slice(open, close));

  if (declared === null) {
    return { parameters: [{ name: 'message', type: 'string' }], properties: [], message: 'message' };
  }

  const list = open + declared.index + declared[0].length - 1;
  const block = code.indexOf('{', matchingBracket(code, list));
  const called = SUPER.exec(code.slice(block, matchingBracket(code, block)));
  const given = called === null ? [] : callArguments(code, block + called.index + called[0].length - 1);
  const [message] = given;

  const written = splitTopLevel(code.slice(list + 1, matchingBracket(code, list))).map((part) => part.code);

  return {
    parameters: written.flatMap(parameterOf),
    properties: written
      .filter((part) => MODIFIERS.exec(part)?.[0] !== '')
      .flatMap(parameterOf)
      .map(({ name }) => name),
    message: message === undefined ? "''" : text.slice(message.start, message.start + message.code.length),
  };
}

function parameterOf(written: string): LegacyParameter[] {
  const bare = written.replace(MODIFIERS, '').trim();
  const [, name, type] = /^([A-Za-z_$][\w$]*)\??\s*(?::\s*([^=]+))?/.exec(bare) ?? [];

  return name === undefined ? [] : [{ name, type: type?.trim() ?? 'unknown' }];
}

function manualReason({ text, scanned, open, close }: Body): { manual?: string } {
  const { code } = scanned;
  const inside = code.slice(open + 1, close);
  const called = SUPER.exec(inside);
  const given = called === null ? [] : callArguments(code, open + 1 + called.index + called[0].length - 1);

  if (given.length > 1) {
    return { manual: 'its constructor gives options to super(..): write the factory by hand, with .causedBy(..)' };
  }

  if (/\bthis\./.test(inside)) {
    return { manual: 'its constructor reads or writes `this`: write the factory by hand' };
  }

  // A member other than the code and the constructor: text is read so that a field holding a string counts.
  return MEMBER.test(withoutConstructor(text.slice(open + 1, close)))
    ? { manual: 'it has members of its own: write the factory by hand and decide where they go' }
    : {};
}

function withoutConstructor(body: string): string {
  const at = body.search(CONSTRUCTOR);

  if (at === -1) {
    return body;
  }

  const block = body.indexOf('{', matchingBracket(body, body.indexOf('(', at)));

  return body.slice(0, at) + body.slice(matchingBracket(body, block) + 1);
}
