import { ConceptError } from '@ddd-ts-kit/kernel';

/** What the organisations refuse: an organisation is a group of accounts, and the tenant of its data when the project has tenants. */
export class OrganisationError extends ConceptError {
  static notFound(organisationId: string) {
    return OrganisationError.refusal('ORGANISATION_NOT_FOUND', `No organisation ${organisationId}.`, {
      organisationId,
    }).exposing('organisationId');
  }

  static slugTaken(slug: string) {
    return OrganisationError.refusal('ORGANISATION_SLUG_TAKEN', `An organisation is already named ${slug}.`, {
      slug,
    }).exposing('slug');
  }

  static invalidOrganisationName(raw: string) {
    return OrganisationError.refusal(
      'INVALID_ORGANISATION_NAME',
      'The name of an organisation holds between 1 and 100 characters.',
      { raw },
    );
  }

  static invalidOrganisationSlug(raw: string) {
    return OrganisationError.refusal(
      'INVALID_ORGANISATION_SLUG',
      'A slug is 2 to 63 lower-case letters, digits and hyphens, starting with a letter or a digit.',
      { raw },
    );
  }
}
