import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import {
  contextDeclarations,
  contextInjections,
  dependenciesFile,
  isDeclarationsFile,
  renderDependenciesFile,
  renderInjections,
  type ClassInjection,
  type Sources,
} from '../declared/index.js';
import type { Workspace } from '../workspace/index.js';
import { filesUnder } from './files-under.js';
import { isDeclared } from './is-declared.js';
import { workspaceSources } from './workspace-sources.js';

/**
 * Rewrites the generated files of every declared context from its tree: with a barrel, the
 * declarations of each role folder, which export its role files and register what each
 * constructor receives, and the summary at the root of the context, deleting the declarations of
 * a folder that holds no role file any more; under discovery `<context>.dependencies.ts`, which
 * registers the lists alone. Called at the end of every `generate` and by `docs`: these files are
 * derived, like the documentation, and `declarations/barrel-current` reports one left behind.
 */
export function refreshBarrels(ws: Workspace, config: Config): void {
  if (!isDeclared(config)) {
    return;
  }

  const sources = workspaceSources(ws, config);

  for (const context of ws.directories(config.contextsDir)) {
    if (config.contexts[context] !== undefined) {
      refreshContext(ws, { config, sources, context });
    }
  }
}

interface Refreshed {
  readonly config: Config;
  readonly sources: Sources;
  readonly context: string;
}

function refreshContext(ws: Workspace, { config, sources, context }: Refreshed): void {
  const directory = `${config.contextsDir}/${context}`;
  const entries = filesUnder(ws, directory);
  const specifierOfFile = (file: string): string => specifierOf(config, file);

  if (config.stack.assembly === 'barrel') {
    const { files, injections } = contextDeclarations({
      context,
      directory,
      entries,
      sources,
      specifierOf: specifierOfFile,
    });

    noteUnread(ws, injections);
    files.forEach((content, file) => write(ws, `${directory}/${file}`, content));

    // The declarations of a folder that holds no role file any more: nothing derives them now.
    entries
      .filter((entry) => isDeclarationsFile(context, entry) && !files.has(entry))
      .forEach((entry) => ws.delete(`${directory}/${entry}`));

    return;
  }

  const injections = contextInjections(sources, directory, entries);
  const injected = renderInjections(injections, specifierOfFile);

  noteUnread(ws, injections);

  if (injected.calls.length > 0 || ws.exists(`${directory}/${dependenciesFile(context)}`)) {
    write(ws, `${directory}/${dependenciesFile(context)}`, renderDependenciesFile(injected));
  }
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
