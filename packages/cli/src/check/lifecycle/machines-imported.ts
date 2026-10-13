import type { SourceFile } from '../model/source-file.js';

/** The names a file binds from the state machines of `domain/state-machines/`. */
export function machinesImported(file: SourceFile): string[] {
  return file.imports.flatMap(({ target, names }) => {
    if (target.kind !== 'file' || target.location.area !== 'context') {
      return [];
    }

    const { layer, inside } = target.location;

    return layer === 'domain' && inside[0] === 'state-machines' ? [...names] : [];
  });
}
