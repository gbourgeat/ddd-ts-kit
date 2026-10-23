import type { SourceFile } from '../../check/model/source-file';
import { declaredRoleOf } from '../declared-role-of';
import type { ClassInjection } from './class-injection';
import { readInjections } from './read-injections';
import type { Sources } from './sources';

/** The files of a context: its directory from the project root, its files relative to it, the modules of its model. */
export interface ContextFiles {
  readonly directory: string;
  readonly entries: readonly string[];
  readonly modules: readonly string[];
}

/** What every declared class of a context is given, in the order of its role files. */
export function contextInjections(sources: Sources, { directory, entries, modules }: ContextFiles): ClassInjection[] {
  return [...new Set(entries)]
    .filter((entry) => declaredRoleOf(entry, modules) !== undefined)
    .sort()
    .flatMap((entry) => sources(`${directory}/${entry}`) ?? [])
    .flatMap((file: SourceFile) => readInjections(sources, file));
}
