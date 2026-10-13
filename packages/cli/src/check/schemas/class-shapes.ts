import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { DeclaredShape } from './declared-shape.js';
import { topLevelStatements } from './top-level-statements.js';

const DECORATOR_NAME = /@[A-Za-z_$][\w$]*\s*/y;
const PROPERTY = /^(?:(?:readonly|public|declare)\s+)*([A-Za-z_$][\w$]*)\s*([?!])?/;

/**
 * The DTO classes of a source: a class of the module that extends nothing, has no method and
 * gives a decorator to each of its properties. Its shape is its properties, by name, each with
 * its decorators and whether it is optional.
 */
export function classShapes(file: SourceFile, code: string): DeclaredShape[] {
  return file.structure.classes.flatMap((shape) => {
    const members = dtoMembers(shape, code);

    return members === undefined
      ? []
      : [{ key: `class{${members.join(';')}}`, line: shape.line, what: `The class ${shape.name}` }];
  });
}

function dtoMembers(shape: ClassShape, code: string): string[] | undefined {
  if (shape.depth !== 0 || shape.superclass !== undefined || shape.methods.length > 0) {
    return undefined;
  }

  const members = topLevelStatements(code.slice(shape.bodyStart + 1, shape.end), ';').map(member);
  const decorated = members.flatMap((one) => (one === undefined ? [] : [one]));

  return decorated.length === 0 || decorated.length < members.length ? undefined : decorated.sort();
}

/** `name?:@IsString()@MaxLength(500)` for a decorated property; nothing for anything else. */
function member(statement: string): string | undefined {
  const { decorators, rest } = decoratorsOf(statement.trim());
  const property = PROPERTY.exec(rest);

  if (decorators.length === 0 || property === null) {
    return undefined;
  }

  return `${property[1] ?? ''}${property[2] === '?' ? '?' : ''}:${decorators.join('')}`;
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
