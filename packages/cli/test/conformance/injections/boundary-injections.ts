import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';
import { SOURCE_ALIAS } from '../source-alias.js';

const { ADAPTER, ANALYTICS, CONFIG, DUE_HANDLER, NOTIFICATION, OCCUPANCY_ROUTE, PLAN_HANDLER, PUBLISHED } = PATHS;
const { SENT_AGGREGATE } = PATHS;
const ALIAS = `${SOURCE_ALIAS}contexts/notification`;
const SCHEMA = `${NOTIFICATION}/infrastructure/persistence/notification.schema.ts`;
const OCCUPANCY_HANDLER = `${ANALYTICS}/application/queries/search-occupancy/search-occupancy.handler.ts`;

/** Layers and contexts: an import that crosses a boundary, and a relationship that closes a cycle. */
export const BOUNDARY_INJECTIONS: readonly Injection[] = [
  {
    rule: 'layer/domain-purity',
    what: 'an aggregate that imports the mapper of its own persistence',
    file: SENT_AGGREGATE,
    changes: [
      {
        file: SENT_AGGREGATE,
        where: 'start',
        to: `import '${ALIAS}/infrastructure/persistence/reminder.mapper.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/layer-domain-purity',
  },
  {
    rule: 'layer/application-inward',
    what: 'a command handler that imports a repository adapter',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        where: 'start',
        to: `import '${ALIAS}/infrastructure/persistence/knex-reminder.repository.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/layer-application-inward',
  },
  {
    rule: 'layer/presentation-no-infrastructure',
    what: 'a route that imports a read adapter',
    file: OCCUPANCY_ROUTE,
    changes: [
      {
        file: OCCUPANCY_ROUTE,
        where: 'start',
        to: `import '${SOURCE_ALIAS}contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/layer-presentation-no-infrastructure',
  },
  {
    rule: 'layer/infrastructure-no-presentation',
    what: 'an adapter that imports a response body of the HTTP boundary',
    file: ADAPTER,
    changes: [
      { file: ADAPTER, where: 'start', to: `import '${ALIAS}/presentation/http/search-notifications-line.dto.js';\n` },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/layer-infrastructure-no-presentation',
  },
  {
    rule: 'context/published-language-only',
    what: 'a handler of notification that imports an aggregate of scheduling',
    file: DUE_HANDLER,
    changes: [
      {
        file: DUE_HANDLER,
        where: 'start',
        to: `import '${SOURCE_ALIAS}contexts/scheduling/domain/aggregates/appointment.aggregate.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/context-published-language-only',
  },
  {
    rule: 'context/declared-relationship',
    what: 'analytics reading the published language of identity, which it does not declare as an upstream',
    file: OCCUPANCY_HANDLER,
    changes: [
      {
        file: OCCUPANCY_HANDLER,
        where: 'start',
        to: `import '${SOURCE_ALIAS}contexts/identity/published-language/index.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/context-declared-relationship',
  },
  {
    rule: 'context/published-language-is-a-contract',
    what: 'an integration event declaration that imports the aggregate it describes',
    file: PUBLISHED,
    changes: [
      {
        file: PUBLISHED,
        where: 'start',
        to: `import '${SOURCE_ALIAS}contexts/scheduling/domain/aggregates/appointment.aggregate.js';\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/context-published-language-is-a-contract',
  },
  {
    rule: 'context/no-cycle',
    what: 'identity declared downstream of scheduling, which is downstream of identity',
    file: CONFIG,
    changes: [
      {
        file: CONFIG,
        from: '"classification": "supporting",\n      "upstreams": []',
        to: '"classification": "supporting",\n      "upstreams": [{ "context": "scheduling", "relationship": "conformist" }]',
      },
    ],
    checker: true,
  },
  {
    rule: 'context/extractable',
    what: 'the persistence of notification named after the database schema of scheduling',
    file: SCHEMA,
    changes: [{ file: SCHEMA, from: "schemaNameOf('notification')", to: "schemaNameOf('scheduling')" }],
    checker: true,
    eslint: 'ddd-ts-kit/context-extractable',
  },
  {
    rule: 'tree/closed',
    what: 'a directory the canonical tree does not know',
    file: `${NOTIFICATION}/helpers`,
    changes: [
      {
        file: `${NOTIFICATION}/helpers/format-address.ts`,
        to: 'export function formatAddress(address: string): string {\n  return address.trim().toLowerCase();\n}\n',
      },
    ],
    checker: true,
  },
];
