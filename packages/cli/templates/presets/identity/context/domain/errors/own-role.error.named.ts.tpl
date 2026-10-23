import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class OwnRole extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.OwnRole;

  static forOrganisation(organisationId: string) {
    return OwnRole.refusal(`A member of ${organisationId} does not change their own role: another member does.`, {
      organisationId,
    });
  }
}
