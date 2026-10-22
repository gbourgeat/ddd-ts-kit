import type { CodeList } from '../check/errors/code-list.js';
import { codeListName } from '../check/errors/code-list-name.js';
import { errorCodes } from '../check/errors/error-codes.js';
import { readCodeList } from '../check/errors/read-code-list.js';
import { refusalClasses } from '../check/errors/refusal-classes.js';
import { scan, type Scan } from '../check/scan/scan.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { staticMethods, type StaticMethod } from '../generate/errors/static-methods.js';
import type { ErrorFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { exposedBy } from './exposed-by.js';
import { readRefusals } from './read-refusals.js';
import { roleFilesOf } from '../model-modules/index.js';

const FOLDER = 'domain/errors';
const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)[^{]*\{/g;

/**
 * The refusals of a context: one row per static factory of an error class, with its code and
 * the facts it exposes, and one row per class that carries its code itself, as 0.2 wrote them.
 * A class of one refusal (`"stack.refusals": "named"`) gives one row per factory, its code read
 * from `domain/errors/codes.ts`.
 */
export function readErrors({ ws, directory, name: context }: ContextSources): ErrorFact[] {
  const list = codeListOf(ws.read(`${directory}/${FOLDER}/codes.ts`), context);

  return roleFilesOf(ws, directory, FOLDER)
    .filter(({ name }) => name.endsWith('.error.ts'))
    .flatMap(({ path: file }) => {
      const scanned = scan(ws.read(file) ?? '');
      const named = new Set(refusalClasses(scanned).map((shape) => shape.name));

      const concepts = [...scanned.code.matchAll(CLASS)]
        .filter((declared) => !named.has(declared[1] ?? ''))
        .flatMap((declared) => errorsOf(scanned, declared, file));

      return [...concepts, ...readRefusals(scanned, list, file)];
    });
}

/** The code list of the context, `<Context>Codes` in `domain/errors/codes.ts`; undefined without one. */
function codeListOf(text: string | undefined, context: string): CodeList | undefined {
  return text === undefined ? undefined : readCodeList(scan(text), codeListName(context));
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
