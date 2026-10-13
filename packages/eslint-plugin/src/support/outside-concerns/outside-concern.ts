/**
 * Packages that apply or record a concern from outside the model and the use cases: domain/
 * and application/ never import them, whatever the allow-lists of the config say
 * (docs/ARCHITECTURE.md, "Cross-cutting behaviour" and "Tracing").
 */
interface OutsideConcern {
  readonly why: string;
  readonly fix: string;
}

export const ASPECTS_PACKAGE = '@ddd-ts-kit/aspects';

const OUTSIDE_CONCERNS: Readonly<Record<string, OutsideConcern>> = {
  [ASPECTS_PACKAGE]: {
    why: 'an aspect (logging, metrics, retry, timeout, circuit breaking, caching) is applied from outside, never written in the model or in a use case',
    fix: 'Remove the import and apply the aspect at the composition root (`.with(...)` on the binding, or the `decorate` hook), in a bus middleware for what concerns every use case, or on an adapter class in infrastructure/.',
  },
  '@ddd-ts-kit/tracing': {
    why: 'tracing is non-invasive, a span is opened around an adapter or a use case, never by the model or the use case itself',
    fix: 'Remove the import: adapters, use cases, events and jobs are observed from outside by `traceApplication()`, given to the kernel module at the composition root; what has to open a span of its own lives in the platform.',
  },
  '@ddd-ts-kit/redis': {
    why: 'Redis is a technology behind a port',
    fix: 'Depend on the port (`Cache` of @ddd-ts-kit/kernel, or a port in application/ports) and bind the Redis adapter in the platform.',
  },
  '@ddd-ts-kit/s3': {
    why: 'an object store is a technology behind the FileStorage port',
    fix: 'Depend on `FileStorage` (or `FileStaging` and `FileKeys`) of @ddd-ts-kit/kernel and bind the S3 connector in the platform (`init --storage s3`).',
  },
  '@ddd-ts-kit/scheduling': {
    why: 'the scheduler is a technology behind the `JobScheduler` port, and a job only declares its schedule',
    fix: 'Remove the import: declare the job with `@Scheduled` of @ddd-ts-kit/kernel/declarations (or `builder.job(..)` in the module file) and let the composition root bind the scheduler.',
  },
  '@ddd-ts-kit/sentry': {
    why: 'error reporting is done from outside, behind the `ErrorReporter` port',
    fix: 'Remove the import: failures are reported by the bus middleware, the HTTP error mapper and the job runner wired at the composition root; a use case raises a `DomainError` and reports nothing itself.',
  },
  '@ddd-ts-kit/audit': {
    why: 'the audit trail is recorded from outside the use cases',
    fix: 'Remove the import: the trail is fed by the bus middleware, the authorization hook and an event subscription, all wired at the composition root, never by a use case.',
  },
};

export function outsideConcern(packageName: string): OutsideConcern | undefined {
  return OUTSIDE_CONCERNS[packageName];
}
