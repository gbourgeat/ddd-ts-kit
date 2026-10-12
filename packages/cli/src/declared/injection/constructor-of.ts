import type { SourceFile } from '../../check/model/source-file.js';
import { importedFrom } from '../../check/support/imported-from.js';
import { exportedNameOf } from './exported-name-of.js';
import type { ReadConstructor } from './read-constructor.js';
import type { Sources } from './sources.js';

interface Lookup {
  readonly sources: Sources;
  readonly file: SourceFile;
  readonly className: string;
}

const DEEPEST = 8;

/**
 * The constructor of the class `className` of `file`: the one it writes, or the one of the
 * class it extends, followed through the imports as far as the project goes. Undefined when the
 * chain leaves the project (a base class of a package): nothing here can read that constructor.
 */
export function constructorOf(lookup: Lookup, depth = 0): ReadConstructor | undefined {
  const { file, className } = lookup;
  const shape = file.structure.classes.find((candidate) => candidate.name === className && candidate.depth === 0);

  if (shape === undefined || depth > DEEPEST) {
    return undefined;
  }

  const own = shape.methods.find((method) => method.isConstructor);

  if (own !== undefined) {
    return { file, line: own.line, parameters: own.parameters };
  }

  if (shape.superclass === undefined) {
    return { file, line: shape.line, parameters: [] };
  }

  const base = baseOf(lookup, shape.superclass);

  return base === undefined ? undefined : constructorOf(base, depth + 1);
}

function baseOf({ sources, file }: Lookup, superclass: string): Lookup | undefined {
  const target = importedFrom(file, superclass)?.target;

  if (target === undefined) {
    return { sources, file, className: superclass };
  }

  const source = target.kind === 'file' ? sources(target.path) : undefined;

  return source === undefined ? undefined : { sources, file: source, className: exportedNameOf(file, superclass) };
}
