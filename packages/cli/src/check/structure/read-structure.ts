import type { Scan } from '../scan/scan';
import { braceDepthAt } from '../text/brace-depth-at';
import { classBodyBrace } from './class-body-brace';
import { matchingBracket } from '../text/matching-bracket';
import type { ClassShape } from './class-shape';
import { methodsOf } from './methods-of';
import { signatureAt } from './signature-at';
import type { TopLevelFunction } from './top-level-function';

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
  const named = /^class\s+[\w$]+/.exec(match[0])?.[0].length ?? 0;
  const bodyStart = classBodyBrace(code, match.index + named);
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
    ...heritageOf(code.slice(match.index + named, bodyStart)),
    methods: methodsOf(scan, bodyStart, bodyClose),
  };
}

/**
 * What a class extends and implements, read between its name and its body with every type
 * argument left out, its own type parameters first: one whose constraint or default holds an
 * object type, `class Totals<Row extends { id: string }> extends Store<Row>`, hides neither.
 */
function heritageOf(heritage: string): Pick<ClassShape, 'superclass' | 'implemented'> {
  const bare = withoutTypeArguments(heritage);
  const clause = /(?<![\w$])implements\s+([\s\S]+)$/.exec(bare)?.[1] ?? '';

  return {
    superclass: /^\s*extends\s+([\w$.]+)/.exec(bare)?.[1],
    implemented: clause.split(',').flatMap((part) => /^[\w$.]+/.exec(part.trim())?.[0] ?? []),
  };
}

/** The text outside every `<..>`, however nested; the `>` of an arrow closes nothing. */
function withoutTypeArguments(text: string): string {
  let depth = 0;
  let kept = '';

  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);

    if (char === '<') {
      depth += 1;
    } else if (char === '>' && text.charAt(at - 1) !== '=') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      kept += char;
    }
  }

  return kept;
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
