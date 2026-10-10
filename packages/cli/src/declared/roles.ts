/**
 * The role files of a context written in the declared style: the files whose exported class says
 * what it is with a decorator of `@ddd-ts-kit/kernel/declarations`. One table for the generator
 * (the barrel), the checker (`declarations/*`) and the documentation, and the same folders
 * `discoverContext` of `@ddd-ts-kit/di` reads, plus the publishers.
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
  { suffix: 'integration-handler', folders: ['application/integration/handlers'], decorators: ['IntegrationEventHandler'] },
  { suffix: 'event-handler', folders: ['application/event-handlers'], decorators: ['DomainEventHandler'] },
  { suffix: 'publisher', folders: ['application/integration/publishers'], decorators: ['DomainEventHandler'] },
  { suffix: 'policy', folders: ['application/authorization'], decorators: ['Policy'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], decorators: ['Repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], decorators: ['Gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], decorators: ['Adapter'] },
];

/** Every decorator of `@ddd-ts-kit/kernel/declarations`. */
export const DECLARATION_DECORATORS: readonly string[] = [...new Set(DECLARED_ROLES.flatMap((role) => role.decorators))];

/**
 * The suffixes `discoverContext` loads. It does not load `*.publisher` files: under discovery
 * the composition root lists them, and they are reached by an import like any other source.
 */
export const DISCOVERED_SUFFIXES: readonly string[] = [...new Set(DECLARED_ROLES.map((role) => role.suffix))].filter((suffix) => suffix !== 'publisher');

/** The role of a source given relative to its context, or undefined when the file plays none. */
export function declaredRoleOf(file: string): DeclaredRole | undefined {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.spec.ts')) return undefined;
  const stem = file.slice(0, -'.ts'.length);
  return DECLARED_ROLES.find((role) => stem.endsWith(`.${role.suffix}`) && role.folders.some((folder) => file.startsWith(`${folder}/`)));
}

/** The generated barrel of a declared context, relative to the context: what the composition root imports. */
export const barrelFile = (context: string): string => `${context}.declarations.ts`;

/** The tokens of a declared context, relative to the context. */
export const portsFile = (context: string): string => `application/ports/${context}.ports.ts`;

/** The routes a declared context exposes, relative to the context: the one list the composition root mounts. */
export const routesFile = (context: string): string => `presentation/http/${context}.routes.ts`;

/**
 * The barrel of a context: one `export *` per role file, sorted by path, and nothing else. It is
 * derived from the tree, never edited by hand: `ddd-ts-kit check` reports a barrel that differs
 * (`declarations/barrel-current`).
 */
export function renderBarrel(files: readonly string[]): string {
  const roleFiles = [...new Set(files.filter((file) => declaredRoleOf(file) !== undefined))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (roleFiles.length === 0) return 'export {};\n';
  return `${roleFiles.map((file) => `export * from './${file.replace(/\.ts$/, '.js')}';`).join('\n')}\n`;
}
