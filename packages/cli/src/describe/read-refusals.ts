import type { CodeList } from '../check/errors/code-list.js';
import { refusalClasses } from '../check/errors/refusal-classes.js';
import type { Scan } from '../check/scan/scan.js';
import type { ClassShape } from '../check/structure/class-shape.js';
import type { MethodShape } from '../check/structure/method-shape.js';
import type { ErrorFact } from './context-description.js';
import { exposedBy } from './exposed-by.js';

const REFUSAL_CALL = /\.\s*refusal\s*\(/;
const LISTED_CODE = /\breadonly\s+code\s*(?::[^=;]+)?=\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)/;

/**
 * The refusals of the classes of a source that are one refusal each (`"stack.refusals": "named"`):
 * one row per factory, the code read from the code list of the context, since the class names its
 * code there rather than writing it. A class whose code the list does not hold gives no row, as a
 * factory of a concept whose code is not a literal.
 */
export function readRefusals(scanned: Scan, list: CodeList | undefined, file: string): ErrorFact[] {
  return refusalClasses(scanned).flatMap((shape) => {
    const code = list?.entries.find(({ key }) => key === listedKey(scanned, shape, list.name))?.code;

    if (code === undefined) {
      return [];
    }

    const facts = factoriesOf(scanned, shape).map((method) => ({
      errorClass: shape.name,
      refusal: method.name,
      code,
      exposes: exposedBy(scanned, { open: method.bodyStart, end: method.end }),
      file,
      named: true as const,
    }));

    return facts.length === 0
      ? [{ errorClass: shape.name, refusal: '', code, exposes: [], file, named: true as const }]
      : facts;
  });
}

/** The entry of the list a class reads its code from, `<Context>Codes.<Key>`; its own name when it reads none. */
function listedKey(scanned: Scan, shape: ClassShape, listName: string): string {
  const field = LISTED_CODE.exec(scanned.code.slice(shape.bodyStart, shape.end));

  return field !== null && field[1] === listName ? (field[2] ?? shape.name) : shape.name;
}

/** The public static methods of a refusal class that build it through `refusal(..)`. */
function factoriesOf(scanned: Scan, shape: ClassShape): MethodShape[] {
  return shape.methods.filter(
    (method) =>
      method.isStatic &&
      method.visibility === 'public' &&
      REFUSAL_CALL.test(scanned.code.slice(method.bodyStart, method.end)),
  );
}
