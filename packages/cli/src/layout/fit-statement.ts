import { chainLinks } from './chain-links';
import { LINE_WIDTH } from './line-width';
import { nesting } from './nesting';
import { splitTopLevel } from './split-top-level';

const STEP = '  ';
const CLOSERS = ')]}';
/** A chain of more calls than this that passes a function is broken by the formatter even when it fits. */
const CALLS_KEPT_WITH_A_FUNCTION = 2;

/**
 * Lays one statement written on one line out the way the formatter of a generated project does,
 * for the shapes the generator writes: kept on its line when it fits, a call chain broken link
 * by link, the arguments of a call one per line, or only its last argument opened when that is
 * an object or an array and what precedes it fits. The names a team gives decide the layout, so
 * it is measured here and not written in a template.
 */
export function fitStatement(statement: string, indent: string): string[] {
  const links = chainLinks(statement);
  const [start = '', ...calls] = links;
  const isForced = calls.length > CALLS_KEPT_WITH_A_FUNCTION && statement.includes('=>');

  if (indent.length + statement.length <= LINE_WIDTH && !isForced) {
    return [`${indent}${statement}`];
  }

  if (calls.length > 1) {
    return [`${indent}${start}`, ...calls.flatMap((call) => fitStatement(call, `${indent}${STEP}`))];
  }

  return brokenAfterOperator(statement, indent) ?? openLastGroup(statement, indent);
}

const DECLARED = /^(?:const|let) \w+ =(?= )/;
const PROPERTY = /^\w+:(?= )/;
const FUNCTION_HEAD = /^(?:\w+: )?(?:async )?(?:\w+|\([^()]*\)) =>(?= [^{])/;

/**
 * What is declared, answered or given to a property moves to the next line when its own first
 * line would not fit after the `=`, the `=>` or the `:`: a constructor with a long name, the
 * expression a function answers, a value no bracket lets open.
 */
function brokenAfterOperator(statement: string, indent: string): string[] | undefined {
  const head = headOf(statement);

  if (head === undefined || indent.length + firstLineOf(statement, head) <= LINE_WIDTH) {
    return undefined;
  }

  return [`${indent}${head}`, ...fitStatement(statement.slice(head.length).trim(), `${indent}${STEP}`)];
}

function headOf(statement: string): string | undefined {
  const valued = lastGroup(statement) === undefined ? PROPERTY.exec(statement)?.[0] : undefined;

  return FUNCTION_HEAD.exec(statement)?.[0] ?? DECLARED.exec(statement)?.[0] ?? valued;
}

/** How far the first line goes when nothing moves: up to the bracket a declared value opens, the whole statement otherwise. */
function firstLineOf(statement: string, head: string): number {
  const isDeclared = DECLARED.exec(statement)?.[0] === head;
  const bracket = isDeclared ? statement.slice(head.length).search(/[([{]/) : -1;

  return bracket === -1 ? statement.length : head.length + bracket + 1;
}

interface Group {
  readonly open: number;
  readonly close: number;
}

function openLastGroup(statement: string, indent: string): string[] {
  const outer = lastGroup(statement);

  if (outer === undefined) {
    return [`${indent}${statement}`];
  }

  return (
    huggedFunction(statement, outer, indent) ??
    opened(statement, huggedLiteral(statement, outer, indent) ?? outer, indent)
  );
}

function opened(statement: string, group: Group, indent: string): string[] {
  const items = splitTopLevel(statement.slice(group.open + 1, group.close));

  if (items.length === 0) {
    return [`${indent}${statement}`];
  }

  return [
    `${indent}${statement.slice(0, group.open + 1)}`,
    ...items.flatMap((item) => fitStatement(`${item},`, `${indent}${STEP}`)),
    `${indent}${statement.slice(group.close)}`,
  ];
}

/** The bracket pair a statement ends with: the arguments of its call, or the literal it is. */
function lastGroup(statement: string): Group | undefined {
  const depths = nesting(statement);
  const close = statement.replace(/[;,]$/, '').length - 1;
  const open = depths.lastIndexOf(0, close - 1);
  const isClosed = depths[close] === 0 && CLOSERS.includes(statement[close] ?? ' ');

  return isClosed && open !== -1 ? { open, close } : undefined;
}

/** The object or array a call receives last, when the formatter opens it alone: it is the only argument, or the line fits up to its bracket. */
function huggedLiteral(statement: string, group: Group, indent: string): Group | undefined {
  const items = splitTopLevel(statement.slice(group.open + 1, group.close));
  const last = items.at(-1) ?? '';
  const open = group.close - last.length;

  if (!endsWithLiteral(statement, group, last)) {
    return undefined;
  }

  const fits = indent.length + open + 1 <= LINE_WIDTH && items.at(-2)?.[0] !== last[0];

  return items.length === 1 || fits ? { open, close: group.close - 1 } : undefined;
}

function endsWithLiteral(statement: string, group: Group, last: string): boolean {
  const isLiteral = /^[{[]/.test(last) && lastGroup(last)?.open === 0;
  const isWrittenLast = statement.slice(group.close - last.length, group.close) === last;

  return statement[group.open] === '(' && isLiteral && isWrittenLast;
}

const FUNCTION_ANSWERING_A_CALL = /^(?:async )?(?:\w+|\([^()]*\)) =>(?= [\w.]+\()/;

/** The function a call receives last, when it answers one call and the line fits up to its arrow: the formatter moves what it answers to a line of its own. */
function huggedFunction(statement: string, group: Group, indent: string): string[] | undefined {
  const last = splitTopLevel(statement.slice(group.open + 1, group.close)).at(-1) ?? '';
  const start = group.close - last.length;
  const head = FUNCTION_ANSWERING_A_CALL.exec(last)?.[0];
  const isLastArgument = statement[group.open] === '(' && statement.slice(start, group.close) === last;
  const answersOneCall = head !== undefined && isOneCall(last.slice(head.length).trim());

  if (head === undefined || !answersOneCall || !isLastArgument || indent.length + start + head.length > LINE_WIDTH) {
    return undefined;
  }

  return [
    `${indent}${statement.slice(0, start + head.length)}`,
    ...fitStatement(`${last.slice(head.length).trim()},`, `${indent}${STEP}`),
    `${indent}${statement.slice(group.close)}`,
  ];
}

/**
 * A call, or a chain of calls, and nothing else: `isSystem(actor)`, `expect(a).toEqual(b)`, not
 * `isSystem(actor) && actor.id === id`, which the formatter opens argument by argument. Outside its
 * brackets the body is names and dots only, and it ends on the arguments of its last call.
 */
function isOneCall(body: string): boolean {
  const depths = nesting(body);

  const outside = body
    .split('')
    .filter((char, index) => depths[index] === 0 && !'([{)]}'.includes(char))
    .join('');

  return /^[\w.]+$/.test(outside) && lastGroup(body)?.close === body.length - 1 && body.endsWith(')');
}
