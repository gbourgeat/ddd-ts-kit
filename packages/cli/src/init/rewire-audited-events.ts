import { namedOutsideImports } from '../check/scan/named-outside-imports';
import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { contextVars } from '../generate/context-vars';
import { filesUnder } from '../generate/files-under';
import { parseContextName } from '../naming';
import { renderTemplate } from '../templating';
import type { Workspace } from '../workspace';

const DECLARED = /^export const (\w+)V(\d+) = defineIntegrationEvent\(/gm;
const SUFFIX = '.integration-event.ts';

/**
 * The events a context publishes are in the audit trail: one the registry does not name (a project
 * whose earlier `--force` emptied it, a region the template no longer holds) joins it again, read
 * from its declaration. An import names nothing the registry holds. What the registry names already
 * is left as it is.
 */
export function rewireAuditedEvents(ws: Workspace, config: Config, name: string): void {
  const registry = `${config.platformDir}/audit/audited-events.ts`;
  const context = parseContextName(name);
  const directory = `${config.contextsDir}/${context.kebab}`;

  if (!ws.exists(registry)) {
    return;
  }

  const declarations = filesUnder(ws, directory).filter((file) => file.endsWith(SUFFIX));

  for (const [, camel = '', version = ''] of declarations.flatMap((file) => [
    ...(ws.read(`${directory}/${file}`) ?? '').matchAll(DECLARED),
  ])) {
    if (!namedOutsideImports(ws.read(registry) ?? '', `${camel}V${version}`)) {
      const event = { camel, version };

      applyWiring(
        ws,
        registry,
        renderTemplate('integration-event/audited.tpl', { ...contextVars(config, context), event }),
      );
    }
  }
}
