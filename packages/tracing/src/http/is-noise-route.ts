import { isNoisePath } from './is-noise-path.js';

/** The operations of the documentation routes of `@ddd-ts-kit/http`, one per document of a split contract (`getOpenApiUi_backOffice`). */
const DOCUMENTATION_OPERATION = /^(?:getOpenApiDocument|getOpenApiUi)(?:_\w+)?$/;

/** A route nobody follows in a trace: probes, metrics, and the documentation routes of the kit. */
export function isNoiseRoute(route: { readonly path: string; readonly operationId: string }): boolean {
  return DOCUMENTATION_OPERATION.test(route.operationId) || isNoisePath(route.path);
}
