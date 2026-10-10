import { fitDeclaration } from './fit-declaration.js';
import { fitStatement } from './fit-statement.js';
import { LINE_WIDTH } from './line-width.js';

/**
 * Lays out the lines of a rendered source file that the names of the project made longer than
 * the line width, the way its formatter does. A template writes on one line whatever would fit
 * with short names: the layout is measured here, once the names are known. A statement that
 * takes several lines is set apart from its neighbours by a blank line.
 */
export function fitSource(source: string): string {
  const fitted: string[] = [];
  let inText = false;

  for (const line of source.split('\n')) {
    const laid = inText || isLeftAlone(line) ? [line] : laidOut(line);
    const isBroken = laid.length > 1 && line.endsWith(';') && !line.startsWith('import ');

    if (isBroken && followsStatement(fitted, line)) {
      fitted.splice(aboveItsComments(fitted, line), 0, '');
    }

    fitted.push(...laid, ...(isBroken ? [AFTER_BROKEN] : []));
    inText = inText !== opensText(line);
  }

  return apart(fitted).join('\n');
}

/** Stands after a statement that was broken until the line that follows it is known. */
const AFTER_BROKEN = '\u0000';

function isLeftAlone(line: string): boolean {
  return line.length <= LINE_WIDTH || /^\s*(?:\/\/|\/\*|\*)/.test(line);
}

function laidOut(line: string): string[] {
  const indent = /^\s*/.exec(line)?.[0] ?? '';
  const code = line.slice(indent.length);

  return fitDeclaration(code, indent) ?? fitStatement(code, indent);
}

/** A template literal left open at the end of the line: what follows is text, not code. */
function opensText(line: string): boolean {
  const ticks = line.replace(/\\`/g, '').split('`').length - 1;

  return !/^\s*(?:\/\/|\*)/.test(line) && ticks % 2 === 1;
}

/** The statement is not the first of its block: the line above it, comments aside, ends another one at the same depth. */
function followsStatement(above: readonly string[], line: string): boolean {
  const indent = /^\s*/.exec(line)?.[0] ?? '';
  const previous = above.findLast((row) => !row.startsWith(`${indent}//`) && row !== AFTER_BROKEN);

  return previous !== undefined && previous.startsWith(indent) && /^\S.*[;}]$/.test(previous.slice(indent.length));
}

/** Where the comments written right above the statement start: they stay with it. */
function aboveItsComments(above: readonly string[], line: string): number {
  const indent = /^\s*/.exec(line)?.[0] ?? '';

  return above.findLastIndex((row) => !row.startsWith(`${indent}//`)) + 1;
}

/** A blank line after each broken statement that another statement follows in its block. */
function apart(lines: readonly string[]): string[] {
  return lines.flatMap((line, index) => {
    const next = lines[index + 1] ?? '';

    if (line !== AFTER_BROKEN) {
      return [line];
    }

    return next.trim() === '' || /^\s*[})\]]/.test(next) ? [] : [''];
  });
}
