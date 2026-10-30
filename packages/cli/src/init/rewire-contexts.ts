import type { Config } from '../config';
import { addComposeService } from '../generate/kinds/extraction/add-compose-service';
import { composeServiceOf } from '../generate/kinds/extraction/compose-service-of';
import { wireContext } from '../generate/kinds/wire-context';
import { placeContextFiles } from '../generate/place-context-files';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation';
import { parseContextName } from '../naming';
import type { Workspace } from '../workspace';
import { repositoriesLeftBehind } from './repositories-left-behind';
import { rewireAuditedEvents } from './rewire-audited-events';
import { rewirePersonalData } from './rewire-personal-data';
import { rewirePreset } from './rewire-preset';
import { rewireTables } from './rewire-tables';
import { stackBefore } from './stack-before';

/** What wiring the contexts again gave: the contexts, and the commands that write what it could not. */
export interface Rewired {
  readonly contexts: readonly string[];
  readonly repositories: readonly string[];
}

/**
 * `--force` just rewrote the files of the platform from their templates, what their regions held
 * kept: the contexts the config declares, which it kept, are wired into them again, and what the
 * tree says of each one joins them where a region does not hold it, a region lost or emptied by
 * an earlier version included. What is there already is left as it is.
 */
export function rewireContexts(ws: Workspace, config: Config): Rewired {
  // A project initialised again may keep its code lists and permission sets where 0.86 and 0.87 wrote them.
  placeContextFiles(ws, config);

  const present = Object.entries(config.contexts).filter(([name]) => ws.exists(`${config.contextsDir}/${name}`));
  const earlierOrm = stackBefore(ws.root)?.orm;

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

  return {
    contexts: present.map(([name]) => name),
    repositories: present.flatMap(([name]) => repositoriesLeftBehind(ws, config, { name, earlierOrm })),
  };
}
