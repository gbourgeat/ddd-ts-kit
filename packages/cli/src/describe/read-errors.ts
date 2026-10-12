import { errorCodes } from '../check/errors/error-codes.js';
import { wholeLiteral } from '../check/declarations/whole-literal.js';
import { scan, type Scan } from '../check/scan/scan.js';
import { callArguments } from '../check/text/call-arguments.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { staticMethods, type StaticMethod } from '../generate/errors/static-methods.js';
import type { ErrorFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';

const FOLDER = 'domain/errors';
const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
const EXPOSING = /\.\s*exposing\s*\(/g;

/**
 * The refusals of a context: one row per static factory of an error class, with its code and
 * the facts it exposes, and one row per class that carries its code itself, as 0.2 wrote them.
 */
export function readErrors({ ws, directory }: ContextSources): ErrorFact[] {
  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((name) => name.endsWith('.error.ts'))
    .flatMap((name) => {
      const file = `${directory}/${FOLDER}/${name}`;
      const scanned = scan(ws.read(file) ?? '');

      return [...scanned.code.matchAll(CLASS)].flatMap((declared) => errorsOf(scanned, declared, file));
    });
}

function errorsOf(scanned: Scan, declared: RegExpExecArray, file: string): ErrorFact[] {
  const errorClass = declared[1] ?? '';
  const body = { open: declared.index + declared[0].length - 1, close: 0 };
  const within = { ...body, close: matchingBracket(scanned.code, body.open) };

  const built = staticMethods(scanned.code, within).flatMap((method) => {
    const [code] = codesIn(scanned, method);

    return code === undefined
      ? []
      : [{ errorClass, refusal: method.name, code, exposes: exposedBy(scanned, method), file }];
  });

  const own = errorCodes(scanned)
    .filter(({ code }) => !built.some((fact) => fact.code === code))
    .map(({ code }) => ({ errorClass, refusal: '', code, exposes: [], file }));

  return [...built, ...(built.length === 0 ? own : [])];
}

function codesIn(scanned: Scan, method: StaticMethod): string[] {
  const starts = scanned.lineAt(method.open);
  const ends = scanned.lineAt(method.end);

  return errorCodes(scanned)
    .filter(({ line }) => line >= starts && line <= ends)
    .map(({ code }) => code);
}

function exposedBy(scanned: Scan, method: StaticMethod): string[] {
  return [...scanned.code.matchAll(EXPOSING)]
    .filter((match) => match.index > method.open && match.index < method.end)
    .flatMap((match) => callArguments(scanned.code, match.index + match[0].length - 1))
    .flatMap((argument) => wholeLiteral(scanned, argument) ?? []);
}
