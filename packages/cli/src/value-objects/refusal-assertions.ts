import { scan } from '../check/scan/scan';
import { callArguments } from '../check/text/call-arguments';
import { matchingBracket } from '../check/text/matching-bracket';
import { isConvertedCall } from './is-converted-call';
import { applyEdits } from './apply-edits';
import type { Edit } from './edit';
import { inlineResults } from './inline-results';
import { refusalCode } from './refusal-code';
import type { ResultMethods } from './result-methods';
import type { Rewrite } from './rewrite';

const ASSERTION = /(?<![\w$.])(expect|expectRefusal)\s*\(/g;
const OK_TO_BE = /^\s*\.toBe\(\s*(true|false)\s*\)/;
const TO_MATCH = /^\s*\.toMatchObject\(/;

interface Read {
  readonly code: string;
  readonly source: string;
  readonly methods: ResultMethods;
}

/**
 * The assertions on the `Result` of a factory become assertions on the factory: `.ok` true says
 * it does not throw, a refusal expected by its code is `expectRefusal(() => Email.create(raw), code)`.
 */
export function refusalAssertions(source: string, methods: ResultMethods): Rewrite {
  const inlined = inlineResults(source, methods);
  const read: Read = { code: scan(inlined).code, source: inlined, methods };
  const edits = [...read.code.matchAll(ASSERTION)].flatMap((found) => assertionEdits(read, found));

  return { source: applyEdits(inlined, edits), count: edits.length };
}

function assertionEdits(read: Read, found: RegExpExecArray): Edit[] {
  const open = found.index + found[0].length - 1;

  if (found[1] === 'expectRefusal') {
    return refusalEdits(read, open);
  }

  const close = matchingBracket(read.code, open);
  const subject = read.code.slice(open + 1, close).trimEnd();
  const okEnd = subject.endsWith('.ok') ? open + 1 + subject.length - '.ok'.length : undefined;

  return okEnd === undefined
    ? matchEdits(read, { start: found.index, open, close })
    : okEdits(read, { start: found.index, open, close: okEnd }, close);
}

/** `expectRefusal(Email.create(raw), code)`: the factory is run by the assertion. */
function refusalEdits(read: Read, open: number): Edit[] {
  const [first] = callArguments(read.code, open);

  if (
    first === undefined ||
    !isConvertedCall(read.code, { start: first.start, end: first.start + first.code.length }, read.methods)
  ) {
    return [];
  }

  const at = first.start + first.code.length - first.code.trimStart().length;

  return [{ start: at, end: at, text: '() => ' }];
}

interface Call {
  readonly start: number;
  readonly open: number;
  readonly close: number;
}

function okEdits(read: Read, subject: Call, close: number): Edit[] {
  const asserted = OK_TO_BE.exec(read.code.slice(close + 1));

  if (asserted === null || !isConvertedCall(read.code, { start: subject.open + 1, end: subject.close }, read.methods)) {
    return [];
  }

  const call = read.source.slice(subject.open + 1, subject.close).trim();
  const verdict = asserted[1] === 'true' ? '.not.toThrow()' : '.toThrow()';

  return [{ start: subject.start, end: close + 1 + asserted[0].length, text: `expect(() => ${call})${verdict}` }];
}

function matchEdits(read: Read, subject: Call): Edit[] {
  const matched = TO_MATCH.exec(read.code.slice(subject.close + 1));

  if (matched === null || !isConvertedCall(read.code, { start: subject.open + 1, end: subject.close }, read.methods)) {
    return [];
  }

  const open = subject.close + matched[0].length;
  const close = matchingBracket(read.code, open);
  const code = refusalCode(read.source.slice(open + 1, close));
  const call = read.source.slice(subject.open + 1, subject.close).trim();

  return code === undefined
    ? []
    : [{ start: subject.start, end: close + 1, text: `expectRefusal(() => ${call}, '${code}')` }];
}
