import type { ProjectionApplication } from '../model/projection-application.js';

/** An `@On` that ran, waiting for the `@Projection` of its class: method decorators run first. */
export interface PendingApplication {
  readonly application: ProjectionApplication;
  /** The prototype the legacy call was handed. The standard call hands none. */
  readonly prototype?: object;
}

/*
 * Shared by every copy of this package the process loaded, as the registry is: an `@On` and
 * the `@Projection` above it may come from two copies of the kernel.
 */
const PENDING = Symbol.for('@ddd-ts-kit/kernel/declarations/pending-applications/v1');

export function pendingApplications(): PendingApplication[] {
  const existing: unknown = Reflect.get(globalThis, PENDING);

  if (isPending(existing)) return existing;

  const created: PendingApplication[] = [];

  Reflect.set(globalThis, PENDING, created);

  return created;
}

function isPending(value: unknown): value is PendingApplication[] {
  return Array.isArray(value);
}
