import type { Flaw } from '../model/flaw.js';
import { ASPECTS_PACKAGE } from './aspects-package.js';

interface Concern {
  readonly why: string;
  readonly fix: string;
}

/**
 * Packages that apply or record a concern from outside the model and the use cases: domain/
 * and application/ never import them, whatever the allow-lists of the config say
 * (ARCHITECTURE.md, "Cross-cutting behaviour" and "Tracing").
 */
const OUTSIDE_CONCERNS: Readonly<Record<string, Concern>> = {
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
  '@ddd-ts-kit/audit': {
    why: 'the audit trail is recorded from outside the use cases',
    fix: 'Remove the import: the trail is fed by the bus middleware, the authorization hook and an event subscription, all wired at the composition root, never by a use case.',
  },
  '@ddd-ts-kit/scheduling': {
    why: 'the scheduler is an adapter of the JobScheduler port, a job only says when it runs',
    fix: 'Remove the import: a job declares its schedule with @Scheduled of @ddd-ts-kit/kernel/declarations (or `builder.job(...)` in a module file) and the platform binds the scheduler behind the `JobScheduler` port of @ddd-ts-kit/kernel.',
  },
  '@ddd-ts-kit/s3': {
    why: 'an object store is a technology behind the FileStorage port',
    fix: 'Depend on `FileStorage` (or `FileStaging` and `FileKeys`) of @ddd-ts-kit/kernel and bind the S3 connector in the platform (`init --storage s3`).',
  },
  '@ddd-ts-kit/sentry': {
    why: 'error reporting is wired from outside, behind the ErrorReporter port',
    fix: 'Remove the import: unexpected errors are reported by the platform (a bus middleware and the HTTP boundary) through the `ErrorReporter` port of @ddd-ts-kit/kernel, bound to the Sentry adapter at the composition root.',
  },
};

/** What is wrong with `specifier` (an entry of `packageName`) imported by `importer`, when the package holds an outside concern. */
export function outsideConcern(importer: string, packageName: string, specifier: string): Flaw | undefined {
  const concern = OUTSIDE_CONCERNS[packageName];

  return concern === undefined
    ? undefined
    : { message: `${importer} imports "${specifier}": ${concern.why}.`, fix: concern.fix };
}
