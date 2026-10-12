import type { Config } from '../config/index.js';
import type { ContextFacts } from '../docs/context-facts.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextDescription, Contracts, GatewayFact, PortFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { readAdapters, type AdapterFact } from './read-adapters.js';
import { readConsumedEvents } from './read-consumed-events.js';
import { readPolicies } from './read-policies.js';
import { readPorts } from './read-ports.js';
import { readProjections } from './read-projections.js';
import { readPublishedEvents } from './read-published-events.js';
import { readRoutes } from './read-routes.js';
import { readUseCases } from './read-use-cases.js';

/** Written by `npm run docs:generate` from the running application: the fields of each request, response and payload. */
const CONTRACTS: Contracts = { openapi: 'openapi/openapi.json', eventCatalog: 'docs/integration/event-catalog.md' };

/**
 * Everything the kit can say of one context without running it. `docs` and `describe` both
 * go through here, so the reference of a CONTEXT.md and the data an agent reads cannot disagree.
 */
export function describeContext(ws: Workspace, config: Config, facts: ContextFacts): ContextDescription {
  const directory = `${config.contextsDir}/${facts.name}`;
  const module = ws.read(`${directory}/${facts.name}.module.ts`) ?? '';

  const sources: ContextSources = {
    ws,
    config,
    name: facts.name,
    directory,
    module,
    ...(facts.declarations === undefined ? {} : { declarations: facts.declarations }),
  };

  const useCases = readUseCases(sources);
  const adapters = readAdapters(sources);
  const ports = readPorts(sources, adapters);

  return {
    ...identityOf(facts, directory),
    useCases,
    routes: readRoutes(sources, useCases),
    consumedEvents: readConsumedEvents(sources),
    publishedEvents: readPublishedEvents(sources),
    ports,
    policies: readPolicies(sources),
    projections: readProjections(sources),
    gateways: gatewaysOf(ports, adapters),
    jobs: facts.jobs,
    contracts: CONTRACTS,
  };
}

type Identity = Pick<
  ContextDescription,
  | 'name'
  | 'classification'
  | 'purpose'
  | 'deployable'
  | 'doc'
  | 'glossary'
  | 'upstreams'
  | 'downstreams'
  | 'aggregates'
  | 'domainEvents'
  | 'permissions'
>;

function identityOf(facts: ContextFacts, directory: string): Identity {
  return {
    name: facts.name,
    classification: facts.classification,
    purpose: facts.purpose,
    deployable: facts.deployable,
    doc: `${directory}/CONTEXT.md`,
    glossary: facts.glossaryTerms,
    upstreams: facts.upstreams,
    downstreams: facts.downstreams,
    aggregates: facts.aggregates,
    domainEvents: facts.domainEvents,
    permissions: facts.permissions,
  };
}

/** The ports bound as gateways, each with the context its adapters read. */
function gatewaysOf(ports: readonly PortFact[], adapters: readonly AdapterFact[]): GatewayFact[] {
  return ports
    .filter((port) => port.kind === 'gateway')
    .map(({ name, file, adapters: bound }) => ({
      name,
      upstream: adapters.find((adapter) => bound.includes(adapter.name) && adapter.upstream !== '')?.upstream ?? '',
      adapters: bound,
      file,
    }));
}
