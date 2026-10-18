import { ValueObject } from '@ddd-ts-kit/kernel';
{{#unless refusals.named}}
import { OrganisationError } from '{{alias.context}}/domain/errors/organisation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { InvalidOrganisationName } from '{{alias.context}}/domain/errors/invalid-organisation-name.error{{alias.ext}}';
{{/if}}

const LONGEST = 100;

export type OrganisationNameProps = {
  readonly value: string;
};

/** The name an organisation is shown under: free text, unlike its slug. */
export class OrganisationName extends ValueObject<OrganisationNameProps> {
  private constructor(props: OrganisationNameProps) {
    super(props);
  }

  static create(raw: string): OrganisationName {
    const value = raw.trim();

    if (value.length === 0 || value.length > LONGEST) {
{{#if refusals.named}}
      throw InvalidOrganisationName.forValue(raw);
{{/if}}
{{#unless refusals.named}}
      throw OrganisationError.invalidOrganisationName(raw);
{{/unless}}
    }

    return new OrganisationName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
