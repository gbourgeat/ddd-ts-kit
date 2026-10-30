import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';
import { classStatements, type ClassProperty } from '../structure/class-statements';
import type { DeclaredShape } from './declared-shape';
import { stillGenerated } from './still-generated';

/**
 * The DTO classes of a source: a class of the module that extends nothing, has no method and
 * gives a decorator to each of its properties. Its shape is its properties, by name, each with
 * its decorators and whether it is optional. A class the generator left to fill is not one yet.
 */
export function classShapes(file: SourceFile, code: string): DeclaredShape[] {
  return file.structure.classes.flatMap((shape) => {
    const members = dtoMembers(shape, code);

    return members === undefined || stillGenerated(file, shape.bodyStart, shape.end)
      ? []
      : [{ key: `class{${members.join(';')}}`, line: shape.line, what: `The class ${shape.name}` }];
  });
}

function dtoMembers(shape: ClassShape, code: string): string[] | undefined {
  if (shape.depth !== 0 || shape.superclass !== undefined || shape.methods.length > 0) {
    return undefined;
  }

  const members = classStatements(shape, code).map(member);
  const decorated = members.flatMap((one) => (one === undefined ? [] : [one]));

  return decorated.length === 0 || decorated.length < members.length ? undefined : decorated.sort();
}

/** `name?:@IsString()@MaxLength(500)` for a decorated property; nothing for anything else. */
function member(property: ClassProperty | undefined): string | undefined {
  if (property === undefined || property.decorators.length === 0) {
    return undefined;
  }

  return `${property.name}${property.optional ? '?' : ''}:${property.decorators.join('')}`;
}
