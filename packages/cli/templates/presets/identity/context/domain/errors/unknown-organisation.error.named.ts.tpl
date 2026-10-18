import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class UnknownOrganisation extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.UnknownOrganisation;

  static forOrganisation(organisationId: string) {
    return UnknownOrganisation.refusal(`No organisation ${organisationId}.`, {
      organisationId,
    }).exposing('organisationId');
  }
}
