import type { Kind } from './kind';
import { acceptanceKind } from './kinds/acceptance-kind';
import { aclKind } from './kinds/acl-kind';
import { adapterKind } from './kinds/adapter-kind';
import { adrKind } from './kinds/adr-kind';
import { aggregateKind } from './kinds/aggregate-kind';
import { backgroundJobKind } from './kinds/background-job-kind';
import { builderKind } from './kinds/builder-kind';
import { commandKind } from './kinds/command-kind';
import { contextKind } from './kinds/context-kind';
import { domainErrorKind } from './kinds/domain-error-kind';
import { domainEventKind } from './kinds/domain-event-kind';
import { domainServiceKind } from './kinds/domain-service-kind';
import { e2eKind } from './kinds/e2e-kind';
import { errorKind } from './kinds/error-kind';
import { entityKind } from './kinds/entity-kind';
import { eventHandlerKind } from './kinds/event-handler-kind';
import { fileUploadKind } from './kinds/file-upload-kind';
import { gatewayKind } from './kinds/gateway-kind';
import { formKind } from './kinds/form-kind';
import { guardKind } from './kinds/guard-kind';
import { integrationEventKind } from './kinds/integration-event-kind';
import { integrationHandlerKind } from './kinds/integration-handler-kind';
import { jobKind } from './kinds/job-kind';
import { moduleKind } from './kinds/module-kind';
import { policyKind } from './kinds/policy-kind';
import { portKind } from './kinds/port-kind';
import { processKind } from './kinds/process-kind';
import { projectionKind } from './kinds/projection-kind';
import { queryKind } from './kinds/query-kind';
import { repositoryKind } from './kinds/repository-kind';
import { representationKind } from './kinds/representation-kind';
import { routeGroupKind } from './kinds/route-group-kind';
import { controllerKind, routeKind } from './kinds/route-kind';
import { schemaKind } from './kinds/schema-kind';
import { serviceKind } from './kinds/service-kind';
import { stateMachineKind } from './kinds/state-machine-kind';
import { testWorldKind } from './kinds/test-world-kind';
import { valueObjectKind } from './kinds/value-object-kind';
import { vocabularyKind } from './kinds/vocabulary-kind';
import { workerKind } from './kinds/worker-kind';

/** Every kind `generate` knows, in the order the help lists them. */
export const KINDS: readonly Kind[] = [
  contextKind,
  moduleKind,
  aggregateKind,
  builderKind,
  testWorldKind,
  entityKind,
  valueObjectKind,
  vocabularyKind,
  stateMachineKind,
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
  fileUploadKind,
  routeGroupKind,
  guardKind,
  representationKind,
  formKind,
  schemaKind,
  integrationEventKind,
  integrationHandlerKind,
  eventHandlerKind,
  projectionKind,
  jobKind,
  backgroundJobKind,
  processKind,
  aclKind,
  e2eKind,
  acceptanceKind,
  policyKind,
  gatewayKind,
  adapterKind,
  serviceKind,
  workerKind,
  adrKind,
];
