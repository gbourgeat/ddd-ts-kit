import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class AboveOwnRole extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.AboveOwnRole;

  static forOrganisation(organisationId: string) {
    return AboveOwnRole.refusal(
      `A member of ${organisationId} appoints, changes or removes no one above their own role.`,
      { organisationId },
    );
  }
}
