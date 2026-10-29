/** The word of a role, read from the suffix of a spec file: `slot.vo.spec.ts` is a value object. */
export const SPEC_ROLES: Readonly<Record<string, string>> = {
  aggregate: 'aggregate',
  entity: 'entity',
  vo: 'value object',
  service: 'domain service',
  'state-machine': 'state machine',
  event: 'domain event',
  error: 'error',
  handler: 'handler',
  policy: 'policy',
  'event-handler': 'event handler',
  'integration-handler': 'integration handler',
  publisher: 'publisher',
  job: 'job',
  'background-job': 'background job',
  process: 'process manager',
  projection: 'projection',
  repository: 'repository',
  contract: 'contract',
  controller: 'controller',
  route: 'route',
  guard: 'guard',
  mapper: 'mapper',
  adapter: 'adapter',
  translator: 'translator',
  routes: 'routes',
  permissions: 'permissions',
  module: 'module',
  reader: 'reader',
  document: 'document',
  e2e: 'end to end',
  acceptance: 'acceptance',
  regression: 'regression',
};

/** The roles of the specs of a use case, in the order its heading lists them. */
export const USE_CASE_ROLES = ['handler', 'policy', 'controller', 'route', 'reader', 'repository', 'e2e', 'acceptance'];

/** The roles of the model, in the order of the page: each part of the model under a heading of its own. */
export const MODEL_ROLES = ['aggregate', 'entity', 'vo', 'state-machine', 'service', 'event', 'error'];

/** What reacts to a fact or to time, in the order of the page. */
export const REACTION_ROLES = [
  'event-handler',
  'integration-handler',
  'publisher',
  'projection',
  'process',
  'job',
  'background-job',
];
