import type { ClassInjection } from './injection/class-injection.js';
import { contextInjections } from './injection/context-injections.js';
import { renderInjections } from './injection/render-injections.js';
import type { Sources } from './injection/sources.js';
import { renderDeclarations } from './render-declarations.js';

/** A declared context, read where its files are. */
export interface DeclaredContext {
  readonly context: string;
  /** The directory of the context, from the project root. */
  readonly directory: string;
  /** Its files, relative to it. */
  readonly entries: readonly string[];
  readonly sources: Sources;
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
 * compares the tree with: one declarations file per role folder and the summary at the root.
 */
export function contextDeclarations({
  context,
  directory,
  entries,
  sources,
  specifierOf,
}: DeclaredContext): ContextDeclarations {
  const injections: ClassInjection[] = [];

  const files = renderDeclarations({
    context,
    files: entries,
    specifierOf: (entry) => specifierOf(`${directory}/${entry}`),
    injectedIn: (roleFiles) => {
      const read = contextInjections(sources, directory, roleFiles);

      injections.push(...read);

      return renderInjections(read, specifierOf);
    },
  });

  return { files, injections };
}
