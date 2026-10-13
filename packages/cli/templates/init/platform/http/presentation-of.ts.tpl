import type { Access } from '@ddd-ts-kit/auth';
{{#if presentation.negotiated}}
import { Representations, fieldDeciderOf, type FieldDecider } from '@ddd-ts-kit/http';
{{/if}}
{{#unless presentation.negotiated}}
import { fieldDeciderOf, type FieldDecider } from '@ddd-ts-kit/http';
{{/unless}}
import type { Clock } from '@ddd-ts-kit/kernel';

/** How the answers of the application are presented, the same for the server, the forms and the contract. */
export interface Presentation {
{{#if presentation.negotiated}}
  /** JSON, XML and CSV: each request is answered in the one its `Accept` header prefers among those its route declares in `produces`. */
  readonly representations: Representations;
{{/if}}
  /** Decides the fields a schema reserves to some callers (`withFieldAccess`), through the policies and the authorizer of the application. */
  readonly fieldAccess: FieldDecider;
}

export function presentationOf(access: Access, clock: Clock): Presentation {
  return {
{{#if presentation.negotiated}}
    representations: Representations.standard(),
{{/if}}
    fieldAccess: fieldDeciderOf({ access, clock }),
  };
}
