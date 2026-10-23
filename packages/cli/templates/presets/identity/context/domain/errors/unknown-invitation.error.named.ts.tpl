import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

/** No invitation answers the token or the identifier given. The token of an invitation is never a fact of a refusal. */
export class UnknownInvitation extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.UnknownInvitation;

  static forReference() {
    return UnknownInvitation.refusal('No invitation answers this token or this identifier.');
  }
}
