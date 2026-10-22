import { contextAlias } from '../alias';
import type { Config } from '../config';
import type { Name } from '../naming';
import { aliasVars } from '../stack/alias-vars';
import { stackVars } from '../stack/stack-vars';
import type { RenderContext } from '../templating';
import { named } from './named';
import { storageVars } from './storage-vars';

/** What every template of a context reads: the stack, the context and the alias its files are imported by. */
export function contextVars(config: Config, context: Name): RenderContext {
  return {
    ...stackVars(config),
    context: { ...named(context), schema: context.kebab.replaceAll('-', '_') },
    storage: storageVars(config),
    alias: { ...aliasVars(config), context: contextAlias(config, context.kebab) },
  };
}
