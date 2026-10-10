import { isNoisePath } from './is-noise-path.js';

const DOCUMENTATION_OPERATIONS = new Set(['getOpenApiDocument', 'getOpenApiUi']);

/** A route nobody follows in a trace: probes, metrics, and the documentation routes of the kit. */
export function isNoiseRoute(route: { readonly path: string; readonly operationId: string }): boolean {
  return DOCUMENTATION_OPERATIONS.has(route.operationId) || isNoisePath(route.path);
}
