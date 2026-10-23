import { specifierOf } from '../alias';
import type { Config } from '../config';
import {
  contextDeclarations,
  contextInjections,
  dependenciesFile,
  earlierLayoutNotice,
  earlierLayoutOf,
  isDeclarationsFile,
  renderDependenciesFile,
  renderInjections,
  type ClassInjection,
  type DeclaredContext,
  type EarlierLayout,
  type Sources,
} from '../declared';
import { declaredModules } from '../model-modules';
import type { Workspace } from '../workspace';
import { filesUnder } from './files-under';
import { isDeclared } from './is-declared';
import { workspaceSources } from './workspace-sources';

/**
 * Rewrites the generated files of every declared context from its tree: with a barrel, the
 * declarations of each layer, which export its role files and register what each constructor
 * receives, and the summary at the root of the context, deleting the declarations nothing derives
 * any more; under discovery `<context>.dependencies.ts`, which registers the lists alone. Called
 * at the end of every `generate` and by `docs`: these files are derived, like the documentation,
 * and `declarations/barrel-current` reports one left behind. A context still declared as an
 * earlier version wrote it (`earlierLayoutOf`) is moved to the files of its layers, unless
 * `earlier` is `keep`: `docs --check` and `generate --local-only` write nothing outside what they
 * are asked, and say it instead. Answers the contexts kept so.
 */
export function refreshBarrels(ws: Workspace, config: Config, earlier: EarlierDeclarations = 'move'): KeptContext[] {
  if (!isDeclared(config)) {
    return [];
  }

  const sources = workspaceSources(ws, config);
  const kept: KeptContext[] = [];

  for (const context of ws.directories(config.contextsDir)) {
    const layout =
      config.contexts[context] === undefined ? undefined : refreshContext(ws, { config, sources, context, earlier });

    if (layout !== undefined) {
      kept.push({ context, layout });
    }
  }

  return kept;
}

/** What a refresh does with a context still declared as an earlier version wrote it: move it, or keep it as it is. */
export type EarlierDeclarations = 'move' | 'keep';

/** A context a refresh kept in an earlier layout of its declarations. */
export interface KeptContext {
  readonly context: string;
  readonly layout: EarlierLayout;
}

interface Refreshed {
  readonly config: Config;
  readonly sources: Sources;
  readonly context: string;
  readonly earlier: EarlierDeclarations;
}

/** Refreshes one context, and answers the earlier layout it kept, if it kept one. */
function refreshContext(ws: Workspace, { config, sources, context, earlier }: Refreshed): EarlierLayout | undefined {
  const directory = `${config.contextsDir}/${context}`;
  const entries = filesUnder(ws, directory);
  const modules = declaredModules(config, context);
  const specifierOfFile = (file: string): string => specifierOf(config, file);

  if (config.stack.assembly === 'barrel') {
    const declared = { context, directory, entries, sources, modules, specifierOf: specifierOfFile };

    return refreshDeclarations(ws, declared, earlier);
  }

  const injections = contextInjections(sources, { directory, entries, modules });
  const injected = renderInjections(injections, specifierOfFile);

  noteUnread(ws, injections);

  if (injected.calls.length > 0 || modules.length > 0 || ws.exists(`${directory}/${dependenciesFile(context)}`)) {
    write(ws, `${directory}/${dependenciesFile(context)}`, renderDependenciesFile(injected, modules));
  }

  return undefined;
}

/** The declarations of each layer and their summary, the ones nothing derives any more deleted. */
function refreshDeclarations(
  ws: Workspace,
  declared: DeclaredContext,
  earlier: EarlierDeclarations,
): EarlierLayout | undefined {
  const { context, directory, entries, modules } = declared;

  const layout =
    earlier === 'keep' ? earlierLayoutOf(declared, (entry) => ws.read(`${directory}/${entry}`)) : undefined;

  if (layout !== undefined) {
    const { message, fix } = earlierLayoutNotice(context, layout);

    ws.note(`${message} ${fix}`);

    return layout;
  }

  const { files, injections } = contextDeclarations(declared);

  noteUnread(ws, injections);
  files.forEach((content, file) => write(ws, `${directory}/${file}`, content));

  // The declarations of a layer that holds no role file any more, or of a role folder an earlier version wrote.
  entries
    .filter((entry) => isDeclarationsFile(context, entry, modules) && !files.has(entry))
    .forEach((entry) => ws.delete(`${directory}/${entry}`));

  return undefined;
}

/** A class whose constructor cannot be read is given no list: said here, reported by `check`, refused at startup. */
function noteUnread(ws: Workspace, injections: readonly ClassInjection[]): void {
  for (const { className, file, listed, problems } of injections) {
    const [problem] = listed === undefined ? problems : [];

    if (problem !== undefined) {
      ws.note(`${className} (${file}) is registered no dependency list: ${problem.message} ${problem.fix}`);
    }
  }
}

function write(ws: Workspace, file: string, content: string): void {
  if (ws.exists(file)) {
    ws.update(file, content);
  } else {
    ws.create(file, content);
  }
}
