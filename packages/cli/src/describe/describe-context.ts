import type { Config } from '../config/index.js';
import type { ContextFacts } from '../docs/context-facts.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextDescription, Contracts, GatewayFact, PortFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { readAdapters, type AdapterFact } from './read-adapters.js';
import { readConsumedEvents } from './read-consumed-events.js';
import { readErrors } from './read-errors.js';
import { readPolicies } from './read-policies.js';
import { readPorts } from './read-ports.js';
import { readProjections } from './read-projections.js';
import { readPublishedEvents } from './read-published-events.js';
import { readRoutes } from './read-routes.js';
import { readUseCases } from './read-use-cases.js';

const LEGACY_CONTRACT = 'openapi/openapi.json';

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
    errors: readErrors(sources),
    projections: readProjections(sources),
    gateways: gatewaysOf(ports, adapters),
    jobs: facts.jobs,
    contracts: contractsOf(ws, config),
  };
}

/**
 * Written by `npm run docs:generate` from the running application: the fields of each request,
 * response and payload. A project whose scripts still write the JSON contract of 0.4 keeps it.
 */
function contractsOf(ws: Workspace, { openapi }: Config): Contracts {
  const json = openapi.format === 'json' || (ws.exists(LEGACY_CONTRACT) && !ws.exists('openapi/openapi.yaml'));

  return {
    // A contract split into documents is the folder of its files.
    openapi: openapi.documents.length > 0 ? 'openapi/' : json ? LEGACY_CONTRACT : 'openapi/openapi.yaml',
    eventCatalog: 'docs/integration/event-catalog.md',
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
