import { ForbiddenError, Guard, type GuardRequest } from '@ddd-ts-kit/http';

// TODO(domain): say in one sentence what this guard controls at the edge. It reads the caller and the request, never an aggregate: a right that depends on the element is a permission of the use case (`@Requires`).
@Guard()
export class {{name.pascal}}Guard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  check({ actor }: GuardRequest): void {
    // TODO(domain): replace this refusal of everybody by the control: a role, a membership read from the path, a key of the request.
    if (actor.id !== '') {
      throw new ForbiddenError('The caller may not use these routes');
    }
  }
}
