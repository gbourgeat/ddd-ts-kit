import type { SourceFile } from '../model/source-file';
import { explainedMains } from './explained-mains';
import type { ExportVerdict } from './export-verdict';
import type { Exported } from './exported';
import { fileExports } from './file-exports';
import { localTypes } from './local-types';
import { sharesState } from './shares-state';
import { typeFamily } from './type-family';

const COUNTED: readonly Exported['kind'][] = ['class', 'function', 'interface'];

/**
 * Counts the exported classes, interfaces and functions of a file, once per name, and applies the
 * allowances that need no per-file entry. Read as text: an approximation of what ESLint reads on
 * the syntax tree, which is authoritative.
 */
export function judgeExports(file: SourceFile): ExportVerdict {
  const { code } = file.scan;
  const exported = fileExports(file);

  const firsts = exported.filter(
    (candidate, index) =>
      COUNTED.includes(candidate.kind) &&
      exported.findIndex((other) => COUNTED.includes(other.kind) && other.name === candidate.name) === index,
  );

  const counted = firsts.map((first) => ({ ...implementationOf(exported, first), line: first.line }));

  if (counted.length === 0) {
    return { counted, explained: true, mains: [] };
  }

  const types = localTypes(code);
  const mains = explainedMains(exported, counted, types);
  const family = typeFamily({ exported, counted, types, imported: file.imports.flatMap(({ names }) => names) });
  const named = [...mains, ...(family?.declaredBy === undefined ? [] : [family.declaredBy])];
  const explained = named.length > 0 || family !== undefined || sharesState(counted, code, types);

  return { counted, explained, mains: explained ? named : counted };
}

/** Overloads are several declarations of one function: the one with the body is what the function does. */
function implementationOf(exported: readonly Exported[], first: Exported): Exported {
  const sameName = exported.filter((candidate) => candidate.name === first.name && candidate.kind === first.kind);

  return (
    sameName.find((candidate) => candidate.kind === 'function' && candidate.text.length > candidate.signature.length) ??
    first
  );
}
