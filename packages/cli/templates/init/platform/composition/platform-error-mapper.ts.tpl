import { createErrorMapper, type ErrorMapper } from '@ddd-ts-kit/http';

/**
 * What a refusal becomes on the wire. The application and the test platform bind this one mapper,
 * so a route spec answers what the running application answers: map your own errors here, once.
 */
export function platformErrorMapper(): ErrorMapper {
  return createErrorMapper();
}
