/**
 * Packages that apply or record a concern from outside the model and the use cases: domain/
 * and application/ never import them, whatever the allow-lists of the config say
 * (ARCHITECTURE.md, "Cross-cutting behaviour" and "Tracing").
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
    fix: 'Remove the import: adapters are wrapped by the `decorate` hook of the composition root and use cases by a bus middleware; an adapter in infrastructure/ may open a span of its own.',
  },
  '@ddd-ts-kit/redis': {
    why: 'Redis is a technology behind a port',
    fix: 'Depend on the port (`Cache` of @ddd-ts-kit/kernel, or a port in application/ports) and bind the Redis adapter in the platform.',
  },
  '@ddd-ts-kit/audit': {
    why: 'the audit trail is recorded from outside the use cases',
    fix: 'Remove the import: the trail is fed by the bus middleware, the authorization hook and an event subscription, all wired at the composition root, never by a use case.',
  },
};

interface ConcernFinding {
  readonly message: string;
  readonly fix: string;
}

/** What is wrong with `specifier` (an entry of `packageName`) imported by `importer`, when the package holds an outside concern. */
export function outsideConcern(importer: string, packageName: string, specifier: string): ConcernFinding | undefined {
  const concern = OUTSIDE_CONCERNS[packageName];
  return concern === undefined ? undefined : { message: `${importer} imports "${specifier}": ${concern.why}.`, fix: concern.fix };
}
