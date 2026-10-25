import { injectedParameter } from './injected-parameter';

/** The context of the request: its execution context, the version `If-Match` expects, its raw headers. */
export function RouteContext(): (target: object, method: string | symbol | undefined, index: number) => void {
  return injectedParameter('context');
}
