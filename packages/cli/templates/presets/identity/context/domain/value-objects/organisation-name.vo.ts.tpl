import { ValueObject } from '@ddd-ts-kit/kernel';
import { OrganisationError } from '{{alias.context}}/domain/errors/organisation.error{{alias.ext}}';

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
      throw OrganisationError.invalidOrganisationName(raw);
    }

    return new OrganisationName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
