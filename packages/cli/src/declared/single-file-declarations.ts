import type { DeclaredContext } from './context-declarations.js';
import { contextInjections } from './injection/context-injections.js';
import { renderInjections } from './injection/render-injections.js';
import { renderFolderDeclarations } from './render-folder-declarations.js';

/**
 * The declarations of a context as the generator wrote them up to 0.84, all in
 * `<context>.declarations.ts`: one `export *` per role file of the context, sorted by path, then
 * the imports and the `injected(Class, [Tokens])` of every class of the context that takes
 * something. Only `keepsSingleFile` reads it, to recognise a project that has not moved yet.
 */
export function singleFileDeclarations({ directory, entries, sources, modules, specifierOf }: DeclaredContext): string {
  const injected = renderInjections(contextInjections(sources, { directory, entries, modules }), specifierOf);

  const naming = { specifierOf: (entry: string) => specifierOf(`${directory}/${entry}`), modules };

  return renderFolderDeclarations(entries, naming, injected);
}
