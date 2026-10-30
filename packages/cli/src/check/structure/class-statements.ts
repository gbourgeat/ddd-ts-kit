import { topLevelStatements } from '../schemas/top-level-statements';
import { matchingBracket } from '../text/matching-bracket';
import type { ClassShape } from './class-shape';
import { propertyOf, type Property } from './property-of';

/** A property of a class body with the decorators written above it, each without its spaces. */
export interface ClassProperty extends Property {
  readonly decorators: readonly string[];
}

const DECORATOR_NAME = /@[A-Za-z_$][\w$]*\s*/y;

/**
 * Each statement of the body of a class, in its order: the property it declares with its
 * decorators, or nothing for a statement that declares none. Read on the blanked code of the
 * scanner, so a comment or a string never counts.
 */
export function classStatements(shape: ClassShape, code: string): (ClassProperty | undefined)[] {
  return topLevelStatements(code.slice(shape.bodyStart + 1, shape.end), ';').map(classPropertyOf);
}

function classPropertyOf(statement: string): ClassProperty | undefined {
  const { decorators, rest } = decoratorsOf(statement.trim());
  const property = propertyOf(rest);

  return property === undefined ? undefined : { ...property, decorators };
}

/** The decorators that open a statement, their arguments included, and what follows them. */
function decoratorsOf(statement: string): { decorators: string[]; rest: string } {
  const decorators: string[] = [];
  let at = 0;

  for (;;) {
    DECORATOR_NAME.lastIndex = at;

    const name = DECORATOR_NAME.exec(statement);

    if (name === null) {
      return { decorators, rest: statement.slice(at).trim() };
    }

    const open = at + name[0].length;
    const end = statement.charAt(open) === '(' ? matchingBracket(statement, open) + 1 : open;

    decorators.push(statement.slice(at, end).replace(/\s+/g, ''));
    at = end + (statement.slice(end).length - statement.slice(end).trimStart().length);
  }
}
