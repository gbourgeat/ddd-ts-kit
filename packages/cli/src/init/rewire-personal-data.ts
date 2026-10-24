import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { contextVars } from '../generate/context-vars';
import { personalNames, type PersonalNames } from '../generate/kinds/personal-data/personal-names';
import { wiringFamily } from '../generate/wiring-family';
import { parseContextName, type Name } from '../naming';
import { renderTemplate } from '../templating';
import type { Workspace } from '../workspace';

/**
 * `--force` rewrote `data-subject-copies.ts` and `data-subject-exports.ts` from their templates:
 * the erasure and the export of every context that has them are listed in them again, as the
 * ports on tsyringe or as the factories of the hand-wired platform, with the scope when an adapter
 * is confined to the tenant of the work.
 */
export function rewirePersonalData(ws: Workspace, config: Config, name: string): void {
  if (config.stack.privacy !== 'on') {
    return;
  }

  const context = parseContextName(name);
  const names = personalNames(config.stack.orm, context);

  relist(ws, config, { context, names, adapter: names.adapterKebab, list: 'copies' });
  relist(ws, config, { context, names, adapter: names.exportAdapterKebab, list: 'exports' });
}

/** One adapter of a context, and the list of the platform it is listed in. */
interface Listed {
  readonly context: Name;
  readonly names: PersonalNames;
  readonly adapter: string;
  readonly list: 'copies' | 'exports';
}

function relist(ws: Workspace, config: Config, { context, names, adapter, list }: Listed): void {
  const source = ws.read(`${config.contextsDir}/${context.kebab}/infrastructure/persistence/${adapter}.repository.ts`);

  if (source === undefined) {
    return;
  }

  const family = wiringFamily(config) === 'manual' ? 'manual' : 'tsyringe';
  const scoped = source.includes('scope: ExecutionScope)');
  const vars = { ...contextVars(config, context), personal: { names: { ...names } }, tenant: { scoped } };

  applyWiring(
    ws,
    `${config.platformDir}/privacy/data-subject-${list}.ts`,
    renderTemplate(`personal-data/${list}.${family}.tpl`, vars),
  );
}
