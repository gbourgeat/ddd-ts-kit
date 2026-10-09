import type { Scan } from './scanner.js';

/**
 * A shallow reading of declarations, enough for the clean/* rules: classes with their
 * methods, top-level functions, their parameters and the extent of their bodies. Built on
 * the blanked code of the scanner, so braces in strings and comments never count.
 */

type Visibility = 'public' | 'protected' | 'private';

export interface FunctionShape {
  readonly name: string;
  readonly line: number;
  /** Offset of the declaration and of the end of its body. */
  readonly start: number;
  readonly end: number;
  readonly parameters: readonly string[];
  /** Lines holding code strictly inside the body. */
  readonly bodyLines: number;
}

export interface MethodShape extends FunctionShape {
  readonly visibility: Visibility;
  readonly isStatic: boolean;
  readonly isConstructor: boolean;
  readonly isAccessor: boolean;
}

export interface ClassShape {
  readonly name: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly superclass: string | undefined;
  readonly methods: readonly MethodShape[];
}

export interface TopLevelFunction extends FunctionShape {
  readonly exported: boolean;
}

export interface Structure {
  readonly classes: readonly ClassShape[];
  readonly functions: readonly TopLevelFunction[];
}

const OPENERS = '({[';
const CLOSERS = ')}]';

const TYPE_LITERAL_PRECEDERS = ':|&<,(?[';

interface Signature {
  readonly parameters: readonly string[];
  readonly bodyOpen: number;
  readonly bodyClose: number;
}

const MEMBER =
  /((?:(?:public|private|protected|static|readonly|async|override|abstract|declare|get|set)\s+)*)(\*?\s*#?[A-Za-z_$][\w$]*)\s*\??\s*(?:<[^<>(){}]*(?:<[^<>(){}]*>[^<>(){}]*)*>)?\s*\(/y;
const DECORATOR = /@[\w$.]+\s*/y;

const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)(?:\s*<[^{]*?>)?(?:\s+extends\s+([\w$.]+))?[^{;]*\{/g;
const FUNCTION = /(?<![\w$.])(export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\s*\(/g;

export function readStructure(scan: Scan): Structure {
  const { code } = scan;
  const depths = braceDepths(code);

  const classes: ClassShape[] = [...code.matchAll(CLASS)].map((match) => {
    const bodyOpen = match.index + match[0].length - 1;
    const bodyClose = matching(code, bodyOpen);
    return {
      name: match[1] ?? '',
      line: scan.lineAt(match.index),
      start: match.index,
      end: bodyClose,
      superclass: match[2],
      methods: methodsOf(scan, bodyOpen, bodyClose),
    };
  });

  const functions: TopLevelFunction[] = [];
  for (const match of code.matchAll(FUNCTION)) {
    if ((depths[match.index] ?? 0) !== 0) continue;
    const signature = signatureAt(code, match.index + match[0].length - 1);
    if (signature === undefined) continue;
    functions.push({
      name: match[2] ?? '',
      line: scan.lineAt(match.index),
      start: match.index,
      end: signature.bodyClose,
      parameters: signature.parameters,
      bodyLines: countBodyLines(code, signature.bodyOpen, signature.bodyClose),
      exported: match[1] !== undefined,
    });
  }
  return { classes, functions };
}

function countBodyLines(code: string, open: number, close: number): number {
  return code
    .slice(open + 1, close)
    .split('\n')
    .filter((line) => line.trim() !== '').length;
}

function signatureAt(code: string, openParenthesis: number): Signature | undefined {
  const closeParenthesis = matching(code, openParenthesis);
  const bodyOpen = bodyStart(code, closeParenthesis + 1);
  if (bodyOpen === undefined) return undefined;
  return {
    parameters: splitTopLevel(code.slice(openParenthesis + 1, closeParenthesis)),
    bodyOpen,
    bodyClose: matching(code, bodyOpen),
  };
}

/**
 * Walks the members of a class body. A member can only begin at the start of the body, after
 * a `;` or after a closed block; everything else (property initialisers, nested literals) is
 * stepped over, which is what keeps a call inside an initialiser from looking like a method.
 */
function methodsOf(scan: Scan, bodyOpen: number, bodyClose: number): MethodShape[] {
  const methods: MethodShape[] = [];
  let cursor: Cursor = { at: bodyOpen + 1, memberMayStart: true };
  while (cursor.at < bodyClose) {
    const member = cursor.memberMayStart ? memberAt(scan, cursor.at) : undefined;
    if (member?.method !== undefined) methods.push(member.method);
    cursor = member?.after ?? stepOver(scan.code, cursor);
  }
  return methods;
}

interface Cursor {
  readonly at: number;
  readonly memberMayStart: boolean;
}

/** What begins at `at` when it is a decorator or a member, and where the walk resumes after it. */
function memberAt(scan: Scan, at: number): { method?: MethodShape; after: Cursor } | undefined {
  const { code } = scan;
  if (code.charAt(at) === '@') return { after: { at: afterDecorator(code, at), memberMayStart: true } };
  MEMBER.lastIndex = at;
  const match = /\s/.test(code.charAt(at)) ? null : MEMBER.exec(code);
  if (match === null) return undefined;
  const method = methodAt(scan, match);
  if (method === undefined) return { after: { at: matching(code, at + match[0].length - 1) + 1, memberMayStart: false } };
  return { method, after: { at: method.end + 1, memberMayStart: true } };
}

function afterDecorator(code: string, at: number): number {
  DECORATOR.lastIndex = at;
  const afterName = at + (DECORATOR.exec(code)?.[0].length ?? 1);
  return code.charAt(afterName) === '(' ? matching(code, afterName) + 1 : afterName;
}

function stepOver(code: string, { at, memberMayStart }: Cursor): Cursor {
  const char = code.charAt(at);
  if (/\s/.test(char)) return { at: at + 1, memberMayStart };
  if (OPENERS.includes(char)) return { at: matching(code, at) + 1, memberMayStart: char === '{' };
  return { at: at + 1, memberMayStart: char === ';' };
}

function braceDepths(code: string): Int32Array {
  const depths = new Int32Array(code.length + 1);
  let depth = 0;
  for (let i = 0; i < code.length; i += 1) {
    depths[i] = depth;
    const char = code.charAt(i);
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
  }
  return depths;
}

/**
 * From the parenthesis closing a parameter list, finds the brace opening the body, stepping
 * over a return type that may itself contain object types. Undefined for a bodiless signature.
 */
function bodyStart(code: string, afterParameters: number): number | undefined {
  let i = afterParameters;
  while (i < code.length) {
    const char = code.charAt(i);
    if (endsSignature(char, code.charAt(i + 1))) return undefined;
    if (char === '{' && !opensTypeLiteral(code.slice(afterParameters, i))) return i;
    i = OPENERS.includes(char) ? matching(code, i) + 1 : i + 1;
  }
  return undefined;
}

function endsSignature(char: string, next: string): boolean {
  return char === ';' || char === '}' || (char === '=' && next !== '>');
}

/** A brace after `=>` or after a character that only a type can end with opens an object type, not the body. */
function opensTypeLiteral(sinceParameters: string): boolean {
  const before = sinceParameters.trimEnd();
  const previous = before.charAt(before.length - 1);
  return before.endsWith('=>') || (previous !== '' && TYPE_LITERAL_PRECEDERS.includes(previous));
}

function methodAt(scan: Scan, match: RegExpExecArray): MethodShape | undefined {
  const { code } = scan;
  const signature = signatureAt(code, match.index + match[0].length - 1);
  if (signature === undefined) return undefined;
  const modifiers = match[1] ?? '';
  const name = (match[2] ?? '').replace(/^\*\s*/, '');
  return {
    name,
    line: scan.lineAt(match.index),
    start: match.index,
    end: signature.bodyClose,
    parameters: signature.parameters,
    bodyLines: countBodyLines(code, signature.bodyOpen, signature.bodyClose),
    visibility: /\bprivate\b/.test(modifiers) || name.startsWith('#') ? 'private' : /\bprotected\b/.test(modifiers) ? 'protected' : 'public',
    isStatic: /\bstatic\b/.test(modifiers),
    isConstructor: name === 'constructor',
    isAccessor: /\b(?:get|set)\b/.test(modifiers),
  };
}

/** Offset of the bracket closing the one at `open`, or the end of the text. */
function matching(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const char = code.charAt(i);
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char) && (depth -= 1) === 0) return i;
  }
  return code.length - 1;
}

/** Splits on commas that are not nested in brackets or type arguments. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const arrow = char === '>' && text.charAt(i - 1) === '=';
    if (OPENERS.includes(char) || char === '<') depth += 1;
    else if (CLOSERS.includes(char) || (char === '>' && !arrow)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '' && !part.startsWith('this:') && !part.startsWith('this '));
}
