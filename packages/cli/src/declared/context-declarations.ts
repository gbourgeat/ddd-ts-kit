import type { ClassInjection } from './injection/class-injection';
import { contextInjections } from './injection/context-injections';
import { renderInjections } from './injection/render-injections';
import type { Sources } from './injection/sources';
import type { DeclarationsGrouping } from './declarations-folder-of';
import { renderDeclarations } from './render-declarations';

/** A declared context, read where its files are. */
export interface DeclaredContext {
  readonly context: string;
  /** The directory of the context, from the project root. */
  readonly directory: string;
  /** Its files, relative to it. */
  readonly entries: readonly string[];
  readonly sources: Sources;
  /** The modules of the model it declares, in which its role files may sit. */
  readonly modules: readonly string[];
  /** How a generated import names a file given from the project root. */
  readonly specifierOf: (file: string) => string;
}

/** The generated declarations of a context, by path relative to it, and what each of its declared classes is given. */
export interface ContextDeclarations {
  readonly files: ReadonlyMap<string, string>;
  readonly injections: readonly ClassInjection[];
}

/**
 * What the generator writes for a context assembled by barrel, and what `declarations/barrel-current`
 * compares the tree with: one declarations file per layer and the summary at the root, or, for
 * `keepsRoleFolderFiles`, one per role folder as 0.85 and 0.86 wrote them.
 */
export function contextDeclarations(
  { context, directory, entries, sources, modules, specifierOf }: DeclaredContext,
  grouping: DeclarationsGrouping = 'layer',
): ContextDeclarations {
  const injections: ClassInjection[] = [];

  const files = renderDeclarations({
    context,
    files: entries,
    modules,
    grouping,
    specifierOf: (entry) => specifierOf(`${directory}/${entry}`),
    injectedIn: (roleFiles) => {
      const read = contextInjections(sources, { directory, entries: roleFiles, modules });

      injections.push(...read);

      return renderInjections(read, specifierOf);
    },
  });

  return { files, injections };
}
