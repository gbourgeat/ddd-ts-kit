import { matchingBracket } from '../../check/text/matching-bracket';
import type { ClassBody } from './class-body';

const STATIC_METHOD = /^[ \t]*(?:public\s+)?static\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\(/gm;

/** A static method of a class: its name, and where its block opens and closes in the code. */
export interface StaticMethod {
  readonly name: string;
  readonly open: number;
  readonly end: number;
}

/** The public static methods written in the body of a class, in order. */
export function staticMethods(code: string, body: ClassBody): StaticMethod[] {
  return [...code.matchAll(STATIC_METHOD)]
    .filter((match) => match.index > body.open && match.index < body.close)
    .flatMap((match) => {
      const parameters = match.index + match[0].length - 1;
      const open = code.indexOf('{', matchingBracket(code, parameters));

      return open === -1 ? [] : [{ name: match[1] ?? '', open, end: matchingBracket(code, open) }];
    });
}
