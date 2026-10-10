/**
 * The role files of a context written in the declared style: the files whose exported class says
 * what it is with a decorator of `@ddd-ts-kit/kernel/declarations`. One table for the generator
 * (the barrel), the checker (`declarations/*`) and the documentation, and the same folders
 * `discoverContext` of `@ddd-ts-kit/di` reads.
 */
export interface DeclaredRole {
  /** File suffix, without the extension: `handler` for `*.handler.ts`. */
  readonly suffix: string;
  /** Folders of the context, relative to it, the files of this suffix belong in. */
  readonly folders: readonly string[];
  /** The decorators one of which the exported class carries. */
  readonly decorators: readonly string[];
}

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
  { suffix: 'repository', folders: ['infrastructure/persistence'], decorators: ['Repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], decorators: ['Gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], decorators: ['Adapter'] },
];

/** Every decorator of `@ddd-ts-kit/kernel/declarations`. */
export const DECLARATION_DECORATORS: readonly string[] = [
  ...new Set(DECLARED_ROLES.flatMap((role) => role.decorators)),
];

/** The suffixes `discoverContext` loads: every role. */
export const DISCOVERED_SUFFIXES: readonly string[] = [...new Set(DECLARED_ROLES.map((role) => role.suffix))];
