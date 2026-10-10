import type { Scan } from '../scan/scan.js';
import { BRACKETS } from '../text/brackets.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { MethodShape } from './method-shape.js';
import { signatureAt } from './signature-at.js';

const MEMBER =
  /((?:(?:public|private|protected|static|readonly|async|override|abstract|declare|get|set)\s+)*)(\*?\s*#?[A-Za-z_$][\w$]*)\s*\??\s*(?:<[^<>(){}]*(?:<[^<>(){}]*>[^<>(){}]*)*>)?\s*\(/y;

const DECORATOR = /@[\w$.]+\s*/y;

interface Cursor {
  readonly at: number;
  readonly memberMayStart: boolean;
}

interface Member {
  readonly method?: MethodShape;
  readonly after: Cursor;
}

/**
 * Walks the members of a class body. A member can only begin at the start of the body, after
 * a `;` or after a closed block; everything else (property initialisers, nested literals) is
 * stepped over, which is what keeps a call inside an initialiser from looking like a method.
 */
export function methodsOf(scan: Scan, bodyOpen: number, bodyClose: number): MethodShape[] {
  const methods: MethodShape[] = [];
  let cursor: Cursor = { at: bodyOpen + 1, memberMayStart: true };

  while (cursor.at < bodyClose) {
    const member = cursor.memberMayStart ? memberAt(scan, cursor.at) : undefined;

    if (member?.method !== undefined) methods.push(member.method);

    cursor = member?.after ?? stepOver(scan.code, cursor);
  }

  return methods;
}

/** What begins at `at` when it is a decorator or a member, and where the walk resumes after it. */
function memberAt(scan: Scan, at: number): Member | undefined {
  const { code } = scan;

  if (code.charAt(at) === '@') return { after: { at: afterDecorator(code, at), memberMayStart: true } };

  MEMBER.lastIndex = at;

  const match = /\s/.test(code.charAt(at)) ? null : MEMBER.exec(code);

  if (match === null) return undefined;

  const method = methodAt(scan, match);

  if (method === undefined) return { after: { at: matchingBracket(code, at + match[0].length - 1) + 1, memberMayStart: false } };

  return { method, after: { at: method.end + 1, memberMayStart: true } };
}

function afterDecorator(code: string, at: number): number {
  DECORATOR.lastIndex = at;

  const afterName = at + (DECORATOR.exec(code)?.[0].length ?? 1);

  return code.charAt(afterName) === '(' ? matchingBracket(code, afterName) + 1 : afterName;
}

function stepOver(code: string, { at, memberMayStart }: Cursor): Cursor {
  const char = code.charAt(at);

  if (/\s/.test(char)) return { at: at + 1, memberMayStart };
  if (BRACKETS.openers.includes(char)) return { at: matchingBracket(code, at) + 1, memberMayStart: char === '{' };

  return { at: at + 1, memberMayStart: char === ';' };
}

function methodAt(scan: Scan, match: RegExpExecArray): MethodShape | undefined {
  const signature = signatureAt(scan.code, match.index + match[0].length - 1);

  if (signature === undefined) return undefined;

  const modifiers = match[1] ?? '';
  const name = (match[2] ?? '').replace(/^\*\s*/, '');

  return {
    name,
    line: scan.lineAt(match.index),
    start: match.index,
    end: signature.bodyClose,
    parameters: signature.parameters,
    bodyStart: signature.bodyOpen,
    bodyLines: signature.bodyLines,
    visibility: visibilityOf(modifiers, name),
    isStatic: /\bstatic\b/.test(modifiers),
    isConstructor: name === 'constructor',
    isAccessor: /\b(?:get|set)\b/.test(modifiers),
  };
}

function visibilityOf(modifiers: string, name: string): MethodShape['visibility'] {
  if (/\bprivate\b/.test(modifiers) || name.startsWith('#')) return 'private';

  return /\bprotected\b/.test(modifiers) ? 'protected' : 'public';
}
