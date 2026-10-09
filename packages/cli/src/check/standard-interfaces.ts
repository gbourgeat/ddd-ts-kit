import type { Config } from '../config.js';

/**
 * Names a project gives to a home-made copy of a standard interface of the kernel
 * (ARCHITECTURE.md, "Standard interfaces"), with what to use instead. An explicit table: a
 * pattern on words such as `*Context` or `*Logger` would report adapters and domain concepts.
 */
const PARALLEL_NAMES: Readonly<Record<string, string>> = {
  AppLogger: 'Logger',
  LoggerService: 'Logger',
  LoggerInterface: 'Logger',
  MetricsService: 'Metrics',
  CacheService: 'Cache',
  UserContext: 'ExecutionContext or Actor',
  CurrentUser: 'ExecutionContext or Actor',
  AuthContext: 'ExecutionContext or Actor',
  RequestContext: 'ExecutionContext or Actor',
  UserSession: 'Session',
  AuthSession: 'Session',
  SessionData: 'Session',
  PaginatedResult: 'Page',
  PageResult: 'Page',
  PaginatedResponse: 'Page',
  Paginated: 'Page',
  PaginationParams: 'PageRequest',
  PageParams: 'PageRequest',
  AuditLog: 'AuditEntry of @ddd-ts-kit/audit (AuditStamp for audit columns)',
  AuditLogEntry: 'AuditEntry of @ddd-ts-kit/audit (AuditStamp for audit columns)',
  AuditRecord: 'AuditEntry of @ddd-ts-kit/audit (AuditStamp for audit columns)',
};

/** The standard names themselves: the same name behind an `I` is the same interface declared twice. */
const STANDARD_NAMES = ['Actor', 'Session', 'ExecutionContext', 'Logger', 'Metrics', 'Cache', 'Page', 'PageRequest', 'AuditStamp', 'AuditEntry', 'Clock', 'IdGenerator', 'UnitOfWork'];

const DEFAULTS: Readonly<Record<string, string>> = { ...Object.fromEntries(STANDARD_NAMES.map((name) => [`I${name}`, name])), ...PARALLEL_NAMES };

/** A name the transport boundary legitimately declares: the context of one request, in presentation/ and the platform. */
export const BOUNDARY_NAMES: readonly string[] = ['RequestContext'];

export const STANDARD_INTERFACES_FIX =
  'Standard interfaces come from @ddd-ts-kit/kernel: import the one named here, and add the fields of the project by declaration merging of the extension interface it leaves open (SessionExtensions, ExecutionContextExtensions, ActorExtensions, LogFields, MetricLabels); an implementation is a class named after its technology (`PinoLogger implements Logger`).';

/** The defaults with `standardInterfaces` of the config over them: a string adds or replaces an entry, `false` drops one. */
export function parallelNames(configured: Config['standardInterfaces']): ReadonlyMap<string, string> {
  const names = new Map(Object.entries(DEFAULTS));
  for (const [declared, instead] of Object.entries(configured)) {
    if (instead === false) names.delete(declared);
    else names.set(declared, instead);
  }
  return names;
}

/** The identifiers a replacement text names: `ExecutionContext` and `Actor` for "ExecutionContext or Actor". */
export function standardNamesIn(instead: string): string[] {
  return instead.match(/(?<![\w$@/-])[A-Z][\w$]*/g) ?? [];
}
