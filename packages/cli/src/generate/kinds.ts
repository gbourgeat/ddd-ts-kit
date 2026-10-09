import type { Kind } from './kind.js';
import { commandKind, eventHandlerKind, portKind, queryKind } from './kinds/application.js';
import { gatewayKind, policyKind } from './kinds/authorization.js';
import { contextKind } from './kinds/context.js';
import { aggregateKind, builderKind, domainErrorKind, domainEventKind, domainServiceKind, entityKind, valueObjectKind } from './kinds/domain.js';
import { e2eKind } from './kinds/e2e.js';
import { serviceKind } from './kinds/extraction.js';
import { adrKind } from './kinds/governance.js';
import { aclKind, consumerKind, integrationEventKind } from './kinds/integration.js';
import { routeKind } from './kinds/presentation.js';
import { repositoryKind } from './kinds/repository.js';

export const KINDS: readonly Kind[] = [
  contextKind,
  aggregateKind,
  builderKind,
  entityKind,
  valueObjectKind,
  domainEventKind,
  domainErrorKind,
  domainServiceKind,
  repositoryKind,
  commandKind,
  queryKind,
  portKind,
  routeKind,
  integrationEventKind,
  consumerKind,
  eventHandlerKind,
  aclKind,
  e2eKind,
  policyKind,
  gatewayKind,
  serviceKind,
  adrKind,
];

export function findKind(name: string): Kind | undefined {
  return KINDS.find((kind) => kind.name === name || kind.aliases.includes(name));
}
