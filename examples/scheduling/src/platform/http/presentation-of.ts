import type { Access } from '@ddd-ts-kit/auth';
import { Representations, fieldDeciderOf, type FieldDecider } from '@ddd-ts-kit/http';
import type { Clock } from '@ddd-ts-kit/kernel';

/** How the answers of the application are presented, the same for the server, the forms and the contract. */
export interface Presentation {
  /** JSON, XML and CSV: each request is answered in the one its `Accept` header prefers among those its route declares in `produces`. */
  readonly representations: Representations;
  /** Decides the fields a schema reserves to some callers (`withFieldAccess`), through the policies and the authorizer of the application. */
  readonly fieldAccess: FieldDecider;
}

export function presentationOf(access: Access, clock: Clock): Presentation {
  return {
    representations: Representations.standard(),
    fieldAccess: fieldDeciderOf({ access, clock }),
  };
}
