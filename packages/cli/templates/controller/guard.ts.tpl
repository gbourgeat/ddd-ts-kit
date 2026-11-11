import { ForbiddenError, Guard, type GuardRequest } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';

// TODO(domain): say in one sentence what this guard controls at the edge. It reads the caller and the request, never an aggregate: a right that depends on the element is a permission of the use case (`@Requires`).
@Guard()
export class {{name.pascal}}Guard implements Guard {
  readonly documents = { errors: [KitCodes.Forbidden] };

  // TODO(domain): a guard refuses everybody until it is written. Replace this refusal by the control, read from `actor` and `params` of the request: a role of the caller, a membership read from the path, a key of the request.
  check(_request: GuardRequest): void {
    throw new ForbiddenError('The caller may not use these routes');
  }
}
