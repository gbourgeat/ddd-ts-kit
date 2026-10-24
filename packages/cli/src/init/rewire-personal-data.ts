import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { contextVars } from '../generate/context-vars';
import { personalNames } from '../generate/kinds/personal-data/personal-names';
import { wiringFamily } from '../generate/wiring-family';
import { parseContextName } from '../naming';
import { renderTemplate } from '../templating';
import type { Workspace } from '../workspace';

/**
 * `--force` rewrote `data-subject-copies.ts` from its template: the erasure of every context that
 * has one is listed in it again, as the port on tsyringe or as the factory of the hand-wired
 * platform, with the scope when its adapter is confined to the tenant of the work.
 */
export function rewirePersonalData(ws: Workspace, config: Config, name: string): void {
  const context = parseContextName(name);
  const names = personalNames(config.stack.orm, context);

  const adapter = ws.read(
    `${config.contextsDir}/${context.kebab}/infrastructure/persistence/${names.adapterKebab}.repository.ts`,
  );

  if (adapter === undefined || config.stack.privacy !== 'on') {
    return;
  }

  const family = wiringFamily(config) === 'manual' ? 'manual' : 'tsyringe';
  const scoped = adapter.includes('scope: ExecutionScope)');
  const vars = { ...contextVars(config, context), personal: { names: { ...names } }, tenant: { scoped } };

  applyWiring(
    ws,
    `${config.platformDir}/privacy/data-subject-copies.ts`,
    renderTemplate(`personal-data/copies.${family}.tpl`, vars),
  );
}
