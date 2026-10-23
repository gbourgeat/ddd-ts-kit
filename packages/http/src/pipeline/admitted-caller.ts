import { DomainError, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { guardRefusals } from '../controller/guard-refusals';
import type { RawHeaders } from '../route/raw-headers';
import type { Route } from '../route/route';
import { executionOfRequest } from './execution-of-request';

export interface CallerAdmission {
  readonly route: Route;
  readonly headers: Readonly<RawHeaders>;
  readonly correlationId: string;
  readonly principal: unknown;
  readonly deadline: Date | undefined;
  /** Given the execution of a refused caller, for the hooks to say who was refused. */
  readonly reached: { execution?: ExecutionContext };
}

/**
 * The caller let through or refused before anything of its request is read, when its route
 * decides on who calls: a refused caller learns nothing of what the route expects, and sends no
 * upload for nothing. A refusal is one at the edge, reported like the refusal of a guard.
 */
export async function admittedCaller(admission: CallerAdmission): Promise<void> {
  const { route, headers, correlationId, principal, deadline, reached } = admission;

  if (route.admit === undefined) {
    return;
  }

  const execution = executionOfRequest({ correlationId, headers, principal, deadline });
  const { actor, session } = execution;

  try {
    await route.admit({ headers, actor, ...(session === undefined ? {} : { session }) });
  } catch (error) {
    if (error instanceof DomainError) {
      guardRefusals.mark(error);
    }

    // The tenant the request names is not resolved yet: the execution says who, not where.
    reached.execution = execution;

    throw error;
  }
}
