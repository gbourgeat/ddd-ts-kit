import type { Config } from '../config/index.js';

/** The names of the modules of the model of every context, by context: what a tool without the config at hand is given. */
export type ModulesByContext = Readonly<Record<string, readonly string[]>>;

export function modulesByContext(config: Config): ModulesByContext {
  return Object.fromEntries(
    Object.entries(config.contexts).map(([name, context]) => [name, context.modules.map((module) => module.name)]),
  );
}
