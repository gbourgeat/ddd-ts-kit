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
  /** The package entry the decorators are imported from, when it is not the declarations entry of the kernel. */
  readonly entry?: string;
}

/** Where the decorators of the edge come from: the transport declares its own classes on the kernel. */
const HTTP = '@ddd-ts-kit/http';

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
  { suffix: 'background-job', folders: ['application/background'], decorators: ['Background'] },
  { suffix: 'projection', folders: ['application/projections'], decorators: ['Projection'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], decorators: ['Repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], decorators: ['Gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], decorators: ['Adapter'] },
  { suffix: 'controller', folders: ['presentation/http'], decorators: ['Controller'], entry: HTTP },
  { suffix: 'guard', folders: ['presentation/http'], decorators: ['Guard'], entry: HTTP },
  { suffix: 'mapper', folders: ['presentation/http'], decorators: ['RequestMapper'], entry: HTTP },
  { suffix: 'serializer', folders: ['presentation/http'], decorators: ['Serializer'], entry: HTTP },
];

/** Every declaration decorator: those of `@ddd-ts-kit/kernel/declarations` and those of the edge. */
export const DECLARATION_DECORATORS: readonly string[] = [
  ...new Set(DECLARED_ROLES.flatMap((role) => role.decorators)),
];

/** The entry each decorator is imported from, for the ones that do not come from the kernel. */
export const DECORATOR_ENTRIES: Readonly<Record<string, string>> = Object.fromEntries(
  DECLARED_ROLES.flatMap(({ entry, decorators }) =>
    entry === undefined ? [] : decorators.map((name): [string, string] => [name, entry]),
  ),
);

/** The suffixes `discoverContext` loads under `application/` and `infrastructure/`: every role but those of the edge. */
export const DISCOVERED_SUFFIXES: readonly string[] = [
  ...new Set(DECLARED_ROLES.filter((role) => role.entry === undefined).map((role) => role.suffix)),
];

/** The suffixes `discoverContext` loads under `presentation/`: the roles of the edge. */
export const EDGE_SUFFIXES: readonly string[] = [
  ...new Set(DECLARED_ROLES.filter((role) => role.entry !== undefined).map((role) => role.suffix)),
];
