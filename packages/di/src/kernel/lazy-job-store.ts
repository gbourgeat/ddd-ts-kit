import { JobStore } from '@ddd-ts-kit/scheduling';
import type { Resolve } from '../wiring/resolve.js';

/**
 * The bound job store, resolved at each call: the worker is built when the application registers
 * the background jobs, which must open no connection, and a test replaces the store later.
 */
export function lazyJobStore(resolve: Resolve): JobStore {
  const store = (): JobStore => resolve(JobStore);

  return {
    add: (job) => store().add(job),
    claim: (request) => store().claim(request),
    heartbeat: (lease, leaseUntil) => store().heartbeat(lease, leaseUntil),
    update: (lease, update, leaseUntil) => store().update(lease, update, leaseUntil),
    complete: (lease, at) => store().complete(lease, at),
    fail: (lease, failure) => store().fail(lease, failure),
    release: (lease, runAt) => store().release(lease, runAt),
    cancel: (id, at) => store().cancel(id, at),
    find: (id) => store().find(id),
    retryDead: (ids, now) => store().retryDead(ids, now),
    purgeFinished: (before) => store().purgeFinished(before),
    stats: (queue) => store().stats(queue),
  };
}
