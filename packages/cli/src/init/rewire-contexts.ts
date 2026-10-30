import type { Config } from '../config';
import { addComposeService } from '../generate/kinds/extraction/add-compose-service';
import { composeServiceOf } from '../generate/kinds/extraction/compose-service-of';
import { wireContext } from '../generate/kinds/wire-context';
import { placeContextFiles } from '../generate/place-context-files';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation';
import { parseContextName } from '../naming';
import type { Workspace } from '../workspace';
import { rewireAuditedEvents } from './rewire-audited-events';
import { rewirePersonalData } from './rewire-personal-data';
import { rewirePreset } from './rewire-preset';
import { rewireTables } from './rewire-tables';

/**
 * `--force` just rewrote the files of the platform from their templates, what their regions held
 * kept: the contexts the config declares, which it kept, are wired into them again, and what the
 * tree says of each one joins them where a region does not hold it, a region lost or emptied by
 * an earlier version included. What is there already is left as it is.
 */
export function rewireContexts(ws: Workspace, config: Config): void {
  // A project initialised again may keep its code lists and permission sets where 0.86 and 0.87 wrote them.
  placeContextFiles(ws, config);

  const present = Object.entries(config.contexts).filter(([name]) => ws.exists(`${config.contextsDir}/${name}`));

  for (const [name, { classification, upstreams, deployable }] of present) {
    const context = parseContextName(name);

    wireContext(ws, { config, context, request: { name, classification, upstreams } });
    rewirePersonalData(ws, config, name);
    rewireTables(ws, config, name);
    rewireAuditedEvents(ws, config, name);
    rewirePreset(ws, config, name);

    if (deployable) {
      addComposeService(ws, context.kebab, composeServiceOf(config, context));
    }
  }

  stopIgnoringValidation(ws, config);

  if (present.length > 0) {
    ws.note(
      `--force rewrote the files of the platform from their templates and kept what the generators and the team wrote in their regions, the grants of the roles and the services of the compose file included. It wired the declared contexts again (${present.map(([name]) => name).join(', ')}), and listed again from the tree the tables and the audited events of each one that a region did not hold. Nothing the generators wired is lost, unless a line below names it; \`git diff\` shows the rest.`,
    );
  }
}
