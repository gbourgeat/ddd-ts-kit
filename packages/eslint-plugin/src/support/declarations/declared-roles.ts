import type { DeclaredRole } from './declared-role';

/** Same table as `DECLARED_ROLES` of the CLI, which this plugin does not depend on. */
export const DECLARED_ROLES: readonly DeclaredRole[] = [
  { suffix: 'command', folders: ['application/commands'], decorators: ['Requires', 'Public'] },
  { suffix: 'query', folders: ['application/queries'], decorators: ['Requires', 'Public'] },
  { suffix: 'handler', folders: ['application/commands'], decorators: ['CommandHandler'] },
  { suffix: 'handler', folders: ['application/queries'], decorators: ['QueryHandler'] },
  {
    suffix: 'integration-handler',
    folders: ['application/integration/handlers'],
    decorators: ['IntegrationEventHandler'],
  },
  { suffix: 'event-handler', folders: ['application/event-handlers'], decorators: ['DomainEventHandler'] },
  { suffix: 'publisher', folders: ['application/integration/publishers'], decorators: ['DomainEventHandler'] },
  { suffix: 'policy', folders: ['application/authorization'], decorators: ['Policy'] },
  { suffix: 'job', folders: ['application/scheduling'], decorators: ['Scheduled'] },
  { suffix: 'projection', folders: ['application/projections'], decorators: ['Projection'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], decorators: ['Repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], decorators: ['Gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], decorators: ['Adapter'] },
  { suffix: 'controller', folders: ['presentation/http'], decorators: ['Controller'] },
  { suffix: 'guard', folders: ['presentation/http'], decorators: ['Guard'] },
  { suffix: 'mapper', folders: ['presentation/http'], decorators: ['RequestMapper'] },
  { suffix: 'serializer', folders: ['presentation/http'], decorators: ['Serializer'] },
];
