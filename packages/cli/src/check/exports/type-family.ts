import type { Exported } from './exported.js';
import type { LocalType } from './local-types.js';
import { typeClosure } from './type-closure.js';

/** The type a family of exported functions all return, and the export that declares it when the file does. */
export interface TypeFamily {
  readonly type: string;
  readonly declaredBy: Exported | undefined;
}

interface FileShapes {
  readonly exported: readonly Exported[];
  readonly counted: readonly Exported[];
  readonly types: readonly LocalType[];
  /** The names the file imports. */
  readonly imported: readonly string[];
}

/**
 * Allowance 4a: every exported function returns one type, a class, an interface or a type alias the
 * file exports or imports, or a direct member of that union; what else is counted is of their signatures.
 */
export function typeFamily(shapes: FileShapes): TypeFamily | undefined {
  const functions = shapes.counted.filter((candidate) => candidate.kind === 'function');
  const returned = functions.map(returnedType);
  const [first] = returned;

  if (first === undefined) return undefined;

  const declaring = shapes.exported.filter((candidate) => candidate.kind === 'class' || candidate.kind === 'interface' || candidate.kind === 'type');
  const candidates = [...declaring.map((candidate) => candidate.name), ...(shapes.imported.includes(first) ? [first] : [])];

  const type = candidates.find((name) => {
    const accepted = [name, ...(shapes.types.find((candidate) => candidate.name === name)?.members ?? [])];

    return returned.every((reference) => reference !== undefined && accepted.includes(reference));
  });

  if (type === undefined) return undefined;

  const declaredBy = declaring.find((candidate) => candidate.name === type);
  const closure = typeClosure([...(declaredBy === undefined ? [] : [declaredBy.signature]), ...functions.map((made) => made.signature)], shapes.types);
  const others = shapes.counted.filter((candidate) => candidate.kind !== 'function' && candidate.name !== type);

  return others.every((other) => other.kind === 'interface' && closure.has(other.name)) ? { type, declaredBy } : undefined;
}

/** The name the return type annotation of a function refers to: `T` for `T` and for `T<..>`. */
function returnedType(made: Exported): string | undefined {
  return /\)\s*:\s*([A-Za-z_$][\w$]*)\s*(?:<[^;{]*>)?\s*$/.exec(made.signature)?.[1];
}
