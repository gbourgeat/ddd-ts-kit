import type { Role } from './role.js';

/** The canonical tree of docs/ARCHITECTURE.md section 2, as data. */
export const ROLES: readonly Role[] = [
  { directory: 'published-language', suffixes: [] },
  { directory: 'domain/aggregates', suffixes: ['.aggregate.ts'], oneConcept: true, specFor: ['.aggregate.ts'] },
  { directory: 'domain/entities', suffixes: ['.entity.ts'], oneConcept: true },
  { directory: 'domain/value-objects', suffixes: ['.vo.ts'], oneConcept: true, specFor: ['.vo.ts'] },
  { directory: 'domain/events', suffixes: ['.event.ts'], oneConcept: true },
  { directory: 'domain/errors', suffixes: ['.error.ts'] },
  { directory: 'domain/repositories', suffixes: ['.repository.ts'] },
  { directory: 'domain/services', suffixes: ['.service.ts'], specFor: ['.service.ts'] },
  { directory: 'application/commands/*', suffixes: ['.command.ts', '.handler.ts', '.result.ts'], oneConcept: true, specFor: ['.handler.ts'] },
  { directory: 'application/queries/*', suffixes: ['.query.ts', '.handler.ts', '.result.ts'], oneConcept: true, specFor: ['.handler.ts'] },
  { directory: 'application/ports', suffixes: ['.port.ts'] },
  { directory: 'application/authorization', suffixes: ['.permissions.ts', '.policy.ts'] },
  { directory: 'application/event-handlers', suffixes: ['.event-handler.ts'], oneConcept: true, specFor: ['.event-handler.ts'] },
  { directory: 'application/scheduling', suffixes: ['.job.ts'], oneConcept: true, specFor: ['.job.ts'] },
  { directory: 'application/integration/publishers', suffixes: ['.publisher.ts'] },
  { directory: 'application/integration/handlers', suffixes: ['.integration-handler.ts'], oneConcept: true, specFor: ['.integration-handler.ts'] },
  { directory: 'infrastructure/persistence', suffixes: ['.repository.ts', '.mapper.ts', '.reader.ts', '.schema.ts'] },
  { directory: 'infrastructure/external', suffixes: [] },
  { directory: 'infrastructure/anti-corruption', suffixes: [] },
  { directory: 'presentation/http', suffixes: ['.route.ts', '.controller.ts', '.dto.ts'] },
  { directory: 'presentation/cli', suffixes: [] },
  { directory: 'test/builders', suffixes: ['.builder.ts'] },
];
