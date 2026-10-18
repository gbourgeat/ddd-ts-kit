import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class NotAnOwner extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.NotAnOwner;

  static forOrganisation(organisationId: string) {
    return NotAnOwner.refusal(`Only an owner of ${organisationId} appoints or changes an owner.`, { organisationId });
  }
}
