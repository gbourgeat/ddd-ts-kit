import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class InvalidOrganisationSlug extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvalidOrganisationSlug;

  static forValue(raw: string) {
    return InvalidOrganisationSlug.refusal(
      'A slug is 2 to 63 lower-case letters, digits and hyphens, starting with a letter or a digit.',
      { raw },
    );
  }
}
