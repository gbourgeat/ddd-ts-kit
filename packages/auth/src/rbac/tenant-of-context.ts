import type { CheckRequest } from '../authorization/check-request.js';

/** For `tenantOf`: reads `context.tenantId`, which `requires(..., { context })` provides. */
export function tenantOfContext(request: CheckRequest): string | undefined {
  const tenantId = request.context?.['tenantId'];

  return typeof tenantId === 'string' ? tenantId : undefined;
}
