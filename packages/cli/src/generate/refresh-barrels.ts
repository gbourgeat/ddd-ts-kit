import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import {
  barrelFile,
  contextDeclarations,
  contextInjections,
  dependenciesFile,
  isDeclarationsFile,
  keepsSingleFile,
  renderDependenciesFile,
  renderInjections,
  singleFileNotice,
  type ClassInjection,
  type DeclaredContext,
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
 * A context still declared in the single file of 0.84 (`keepsSingleFile`) is moved to the files
 * of its role folders, unless `singleFile` is `keep`: `docs --check` and `generate --local-only`
 * write nothing outside what they are asked, and say it instead. Answers the contexts kept so.
 */
export function refreshBarrels(ws: Workspace, config: Config, singleFile: SingleFile = 'move'): string[] {
  if (!isDeclared(config)) {
    return [];
  }

  const sources = workspaceSources(ws, config);
  const kept: string[] = [];

  for (const context of ws.directories(config.contextsDir)) {
    if (
      config.contexts[context] !== undefined &&
      refreshContext(ws, { config, sources, context, singleFile }) === 'kept'
    ) {
      kept.push(context);
    }
  }

  return kept;
}

/** What a refresh does with a context still declared in the single file of 0.84: move it, or keep it as it is. */
export type SingleFile = 'move' | 'keep';

interface Refreshed {
  readonly config: Config;
  readonly sources: Sources;
  readonly context: string;
  readonly singleFile: SingleFile;
}

function refreshContext(ws: Workspace, { config, sources, context, singleFile }: Refreshed): 'kept' | 'refreshed' {
  const directory = `${config.contextsDir}/${context}`;
  const entries = filesUnder(ws, directory);
  const specifierOfFile = (file: string): string => specifierOf(config, file);

  if (config.stack.assembly === 'barrel') {
    return refreshDeclarations(ws, { context, directory, entries, sources, specifierOf: specifierOfFile }, singleFile);
  }

  const injections = contextInjections(sources, directory, entries);
  const injected = renderInjections(injections, specifierOfFile);

  noteUnread(ws, injections);

  if (injected.calls.length > 0 || ws.exists(`${directory}/${dependenciesFile(context)}`)) {
    write(ws, `${directory}/${dependenciesFile(context)}`, renderDependenciesFile(injected));
  }

  return 'refreshed';
}

/** The declarations of each role folder and their summary, the ones of an emptied folder deleted. */
function refreshDeclarations(ws: Workspace, declared: DeclaredContext, singleFile: SingleFile): 'kept' | 'refreshed' {
  const { context, directory, entries } = declared;

  if (singleFile === 'keep' && keepsSingleFile(declared, ws.read(`${directory}/${barrelFile(context)}`))) {
    const { message, fix } = singleFileNotice(context);

    ws.note(`${message} ${fix}`);

    return 'kept';
  }

  const { files, injections } = contextDeclarations(declared);

  noteUnread(ws, injections);
  files.forEach((content, file) => write(ws, `${directory}/${file}`, content));

  // The declarations of a folder that holds no role file any more: nothing derives them now.
  entries
    .filter((entry) => isDeclarationsFile(context, entry) && !files.has(entry))
    .forEach((entry) => ws.delete(`${directory}/${entry}`));

  return 'refreshed';
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
