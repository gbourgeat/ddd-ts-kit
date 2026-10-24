/**
 * The words of the kit that say a name holds personal data, as snake case: a name holds one when
 * the words of the name contain the words of the term, in order (`customer_email`, `homePhone`,
 * `billing_street_address`). Narrow on purpose: a word that names a person in most projects and
 * rarely anything else. `privacy.vocabulary` of the config adds the words of the business,
 * `privacy.allow` removes one.
 */
export const PERSONAL_VOCABULARY: readonly string[] = [
  'email',
  'phone',
  'first_name',
  'last_name',
  'given_name',
  'family_name',
  'full_name',
  'display_name',
  'maiden_name',
  'surname',
  'birth_date',
  'date_of_birth',
  'birthdate',
  'birthday',
  'street',
  'postal_code',
  'zip_code',
  'address',
  'iban',
  'card_number',
  'social_security_number',
  'ssn',
  'national_id',
  'passport_number',
  'ip_address',
  'gender',
  'nationality',
];
