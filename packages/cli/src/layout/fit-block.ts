import { fitStatement } from './fit-statement';
import { openCallback } from './open-callback';

/**
 * Lays out what a template adds to a region, statement by statement, at the indentation of the
 * region. A statement that takes several lines is set apart from its neighbours by a blank line,
 * as the layout rules of a generated project ask.
 */
export function fitBlock(lines: readonly string[], indent: string): string[] {
  const fitted: string[] = [];
  let wasBroken = false;

  for (const line of openCallback(lines, indent)) {
    const laid = laidOut(line, indent);
    const isBroken = laid.length > 1 && /^\S.*;$/.test(line);
    const isApart = fitted.length === 0 || fitted.at(-1) === '' || line.trim() === '';

    fitted.push(...((isBroken || wasBroken) && !isApart ? [''] : []), ...laid);
    wasBroken = isBroken;
  }

  return fitted;
}

function laidOut(line: string, indent: string): string[] {
  const own = /^\s*/.exec(line)?.[0] ?? '';

  if (line.trim() === '') {
    return [''];
  }

  return fitStatement(line.trim(), `${indent}${own}`).map((row) => row.slice(indent.length));
}
