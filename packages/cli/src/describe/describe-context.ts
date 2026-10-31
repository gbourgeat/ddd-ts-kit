import type { Config } from '../config';
import { declaredModules, wiringTextOf } from '../model-modules';
import type { ContextFacts } from '../docs/context-facts';
import type { Workspace } from '../workspace';
import type { ContextDescription, Contracts, GatewayFact, PortFact } from './context-description';
import type { ContextSources } from './context-sources';
import { readAdapters, type AdapterFact } from './read-adapters';
import { readConsumedEvents } from './read-consumed-events';
import { readErrors } from './read-errors';
import { readPolicies } from './read-policies';
import { readPorts } from './read-ports';
import { readProjections } from './read-projections';
import { readPublishedEvents } from './read-published-events';
import { readRoutes } from './read-routes';
import { readUseCases } from './read-use-cases';

const LEGACY_CONTRACT = 'openapi/openapi.json';

/**
 * Everything the kit can say of one context without running it. `docs` and `describe` both
 * go through here, so the reference of a CONTEXT.md and the data an agent reads cannot disagree.
 */
export function describeContext(ws: Workspace, config: Config, facts: ContextFacts): ContextDescription {
  const sources = sourcesOf(ws, config, facts);
  const { directory } = sources;

  const useCases = readUseCases(sources);
  const adapters = readAdapters(sources);
  const ports = readPorts(sources, adapters);

  return {
    ...identityOf(facts, directory),
    ...docHeadOf(ws, `${directory}/CONTEXT.md`),
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
    backgroundJobs: facts.backgroundJobs,
    stateMachines: facts.stateMachines,
    processes: facts.processes,
    contracts: contractsOf(ws, config),
  };
}

/** The lines of CONTEXT.md above its generated `## Reference`: the rest prints what `describe` prints. */
function docHeadOf(ws: Workspace, doc: string): { docHead?: number } {
  const reference = (ws.read(doc) ?? '').split('\n').findIndex((line) => /^## Reference\s*$/.test(line));

  return reference > 0 ? { docHead: reference } : {};
}

/** Where the facts of the context are read from: its directory, its modules, its module file and its declarations. */
function sourcesOf(ws: Workspace, config: Config, facts: ContextFacts): ContextSources {
  const directory = `${config.contextsDir}/${facts.name}`;

  return {
    ws,
    config,
    name: facts.name,
    directory,
    modules: declaredModules(config, facts.name),
    module: wiringTextOf(ws, { directory, modules: declaredModules(config, facts.name) }, facts.name),
    ...(facts.declarations === undefined ? {} : { declarations: facts.declarations }),
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
  | 'eventSourced'
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
    eventSourced: facts.eventSourced,
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
