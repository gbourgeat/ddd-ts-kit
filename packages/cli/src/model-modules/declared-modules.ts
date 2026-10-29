import type { Config } from '../config';
import { ownEntry } from '../config/values/own-entry';

/** The names of the modules of the model a context declares in `contexts.<name>.modules`. */
export function declaredModules(config: Config, context: string): string[] {
  return (ownEntry(config.contexts, context)?.modules ?? []).map((module) => module.name);
}
