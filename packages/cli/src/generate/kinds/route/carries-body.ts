import type { Endpoint } from './endpoint';

const WITH_BODY: readonly Endpoint['method'][] = ['POST', 'PUT', 'PATCH'];

/** Whether a request of this method carries a body the route reads: a write that is no deletion. */
export function carriesBody(method: Endpoint['method']): boolean {
  return WITH_BODY.includes(method);
}
