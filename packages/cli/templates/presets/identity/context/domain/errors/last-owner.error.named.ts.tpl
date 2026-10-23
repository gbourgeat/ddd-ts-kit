import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class LastOwner extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.LastOwner;

  static forOrganisation(organisationId: string) {
    return LastOwner.refusal(`${organisationId} keeps at least one owner.`, {
      organisationId,
    }).exposing('organisationId');
  }
}
