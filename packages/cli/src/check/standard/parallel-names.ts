import type { Config } from '../../config/index.js';

const AUDIT_ENTRY = 'AuditEntry of @ddd-ts-kit/audit (AuditStamp for audit columns)';

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
  AuditLog: AUDIT_ENTRY,
  AuditLogEntry: AUDIT_ENTRY,
  AuditRecord: AUDIT_ENTRY,
  JobSchedulerService: 'JobScheduler',
  CronScheduler: 'JobScheduler',
  TaskScheduler: 'JobScheduler',
  CronJob: 'ScheduledJob',
  ScheduledTask: 'ScheduledJob',
  BackgroundJob: 'ScheduledJob',
  ErrorReporterService: 'ErrorReporter',
  ErrorTracker: 'ErrorReporter',
  ExceptionReporter: 'ErrorReporter',
  CrashReporter: 'ErrorReporter',
};

/** The standard names themselves: the same name behind an `I` is the same interface declared twice. */
const STANDARD_NAMES = [
  'Actor',
  'Session',
  'ExecutionContext',
  'Logger',
  'Metrics',
  'Cache',
  'Page',
  'PageRequest',
  'AuditStamp',
  'AuditEntry',
  'Clock',
  'IdGenerator',
  'UnitOfWork',
  'JobScheduler',
  'ScheduledJob',
  'ErrorReporter',
];

const DEFAULTS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(STANDARD_NAMES.map((name) => [`I${name}`, name])),
  ...PARALLEL_NAMES,
};

/** The defaults with `standardInterfaces` of the config over them: a string adds or replaces an entry, `false` drops one. */
export function parallelNames(configured: Config['standardInterfaces']): ReadonlyMap<string, string> {
  const names = new Map(Object.entries(DEFAULTS));

  for (const [declared, instead] of Object.entries(configured)) {
    if (instead === false) {
      names.delete(declared);
    } else {
      names.set(declared, instead);
    }
  }

  return names;
}
