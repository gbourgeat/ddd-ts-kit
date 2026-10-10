import { contextAlias } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { Name } from '../naming/index.js';
import { aliasVars } from '../stack/alias-vars.js';
import { stackVars } from '../stack/stack-vars.js';
import type { RenderContext } from '../templating/index.js';
import { named } from './named.js';
import { storageVars } from './storage-vars.js';

/** What every template of a context reads: the stack, the context and the alias its files are imported by. */
export function contextVars(config: Config, context: Name): RenderContext {
  return {
    ...stackVars(config),
    context: { ...named(context), schema: context.kebab.replaceAll('-', '_') },
    storage: storageVars(config),
    alias: { ...aliasVars(config), context: contextAlias(config, context.kebab) },
  };
}
