import path from 'node:path';
import { CONFIG_FILE, parseConfig, type Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { declaredModules } from './declared-modules.js';

/** The config a workspace was last read with, by its text: a command that changes the config reads the new one. */
const read = new WeakMap<Workspace, { readonly text: string; readonly config: Config | undefined }>();

/**
 * The modules of the model of the context at `directory`, as the config of the project declares
 * them: the readers of the tree agree with `ddd-ts-kit check`, which reads a folder as a module
 * only once the config declares it. Empty without a config or a valid one.
 */
export function modulesOfContext(ws: Workspace, directory: string): string[] {
  const config = configOf(ws);

  return config === undefined ? [] : declaredModules(config, path.posix.basename(directory));
}

function configOf(ws: Workspace): Config | undefined {
  const text = ws.read(CONFIG_FILE) ?? '';
  const known = read.get(ws);

  if (known?.text === text) {
    return known.config;
  }

  const config = parsed(text);

  read.set(ws, { text, config });

  return config;
}

function parsed(text: string): Config | undefined {
  try {
    return text === '' ? undefined : parseConfig(JSON.parse(text));
  } catch {
    // A config that does not parse is reported by config/valid; the readers see no module.
    return undefined;
  }
}
