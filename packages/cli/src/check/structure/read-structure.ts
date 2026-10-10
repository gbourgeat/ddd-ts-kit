import type { Scan } from '../scan/scan.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { ClassShape } from './class-shape.js';
import { methodsOf } from './methods-of.js';
import { signatureAt } from './signature-at.js';
import type { TopLevelFunction } from './top-level-function.js';

export interface Structure {
  readonly classes: readonly ClassShape[];
  readonly functions: readonly TopLevelFunction[];
}

const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)(?:\s*<[^{]*?>)?(?:\s+extends\s+([\w$.]+))?([^{;]*)\{/g;
const BEFORE_CLASS = /(?:(?<![\w$.])(export)\s+(?:default\s+)?)?(abstract\s+)?$/;

const FUNCTION =
  /(?<![\w$.])(export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\s*\(/g;

/**
 * A shallow reading of declarations: classes with their methods, top-level functions, their
 * parameters and the extent of their bodies. Built on the blanked code of the scanner, so
 * braces in strings and comments never count.
 */
export function readStructure(scan: Scan): Structure {
  return {
    classes: [...scan.code.matchAll(CLASS)].map((match) => classShape(scan, match)),
    functions: topLevelFunctions(scan),
  };
}

function classShape(scan: Scan, match: RegExpExecArray): ClassShape {
  const { code } = scan;
  const bodyStart = match.index + match[0].length - 1;
  const bodyClose = matchingBracket(code, bodyStart);
  const before = BEFORE_CLASS.exec(code.slice(Math.max(0, match.index - 40), match.index));

  return {
    name: match[1] ?? '',
    line: scan.lineAt(match.index),
    start: match.index,
    bodyStart,
    end: bodyClose,
    depth: braceDepthAt(code, match.index),
    isExported: before?.[1] !== undefined,
    isAbstract: before?.[2] !== undefined,
    superclass: match[2],
    implemented: implementedBy(match[3] ?? ''),
    methods: methodsOf(scan, bodyStart, bodyClose),
  };
}

function implementedBy(heritage: string): string[] {
  const clause = /(?<![\w$])implements\s+([\s\S]+)$/.exec(heritage)?.[1] ?? '';

  return withoutTypeArguments(clause)
    .split(',')
    .flatMap((part) => /^[\w$.]+/.exec(part.trim())?.[0] ?? []);
}

function withoutTypeArguments(text: string): string {
  let current = text;

  for (;;) {
    const stripped = current.replace(/<[^<>]*>/g, '');

    if (stripped === current) {
      return current;
    }

    current = stripped;
  }
}

function topLevelFunctions(scan: Scan): TopLevelFunction[] {
  const { code } = scan;

  return [...code.matchAll(FUNCTION)].flatMap((match) => {
    const signature =
      braceDepthAt(code, match.index) === 0 ? signatureAt(code, match.index + match[0].length - 1) : undefined;

    if (signature === undefined) {
      return [];
    }

    return [
      {
        name: match[2] ?? '',
        line: scan.lineAt(match.index),
        start: match.index,
        end: signature.bodyClose,
        parameters: signature.parameters,
        bodyStart: signature.bodyOpen,
        bodyLines: signature.bodyLines,
        exported: match[1] !== undefined,
      },
    ];
  });
}
