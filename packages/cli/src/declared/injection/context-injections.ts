import type { SourceFile } from '../../check/model/source-file.js';
import { declaredRoleOf } from '../declared-role-of.js';
import type { ClassInjection } from './class-injection.js';
import { readInjections } from './read-injections.js';
import type { Sources } from './sources.js';

/**
 * What every declared class of a context is given, in the order of its role files.
 * `directory` is the context from the project root, `entries` its files relative to it.
 */
export function contextInjections(sources: Sources, directory: string, entries: readonly string[]): ClassInjection[] {
  return [...new Set(entries)]
    .filter((entry) => declaredRoleOf(entry) !== undefined)
    .sort()
    .flatMap((entry) => sources(`${directory}/${entry}`) ?? [])
    .flatMap((file: SourceFile) => readInjections(sources, file));
}
