import type { Kind } from './kind.js';
import { aclKind } from './kinds/acl-kind.js';
import { adapterKind } from './kinds/adapter-kind.js';
import { adrKind } from './kinds/adr-kind.js';
import { aggregateKind } from './kinds/aggregate-kind.js';
import { builderKind } from './kinds/builder-kind.js';
import { commandKind } from './kinds/command-kind.js';
import { contextKind } from './kinds/context-kind.js';
import { domainErrorKind } from './kinds/domain-error-kind.js';
import { domainEventKind } from './kinds/domain-event-kind.js';
import { domainServiceKind } from './kinds/domain-service-kind.js';
import { e2eKind } from './kinds/e2e-kind.js';
import { errorKind } from './kinds/error-kind.js';
import { entityKind } from './kinds/entity-kind.js';
import { eventHandlerKind } from './kinds/event-handler-kind.js';
import { gatewayKind } from './kinds/gateway-kind.js';
import { formKind } from './kinds/form-kind.js';
import { guardKind } from './kinds/guard-kind.js';
import { integrationEventKind } from './kinds/integration-event-kind.js';
import { integrationHandlerKind } from './kinds/integration-handler-kind.js';
import { jobKind } from './kinds/job-kind.js';
import { policyKind } from './kinds/policy-kind.js';
import { portKind } from './kinds/port-kind.js';
import { projectionKind } from './kinds/projection-kind.js';
import { queryKind } from './kinds/query-kind.js';
import { repositoryKind } from './kinds/repository-kind.js';
import { representationKind } from './kinds/representation-kind.js';
import { routeGroupKind } from './kinds/route-group-kind.js';
import { controllerKind, routeKind } from './kinds/route-kind.js';
import { serviceKind } from './kinds/service-kind.js';
import { valueObjectKind } from './kinds/value-object-kind.js';
import { workerKind } from './kinds/worker-kind.js';

/** Every kind `generate` knows, in the order the help lists them. */
export const KINDS: readonly Kind[] = [
  contextKind,
  aggregateKind,
  builderKind,
  entityKind,
  valueObjectKind,
  domainEventKind,
  errorKind,
  domainErrorKind,
  domainServiceKind,
  repositoryKind,
  commandKind,
  queryKind,
  portKind,
  routeKind,
  controllerKind,
  routeGroupKind,
  guardKind,
  representationKind,
  formKind,
  integrationEventKind,
  integrationHandlerKind,
  eventHandlerKind,
  projectionKind,
  jobKind,
  aclKind,
  e2eKind,
  policyKind,
  gatewayKind,
  adapterKind,
  serviceKind,
  workerKind,
  adrKind,
];
