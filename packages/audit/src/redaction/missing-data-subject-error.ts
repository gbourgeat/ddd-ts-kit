/** A field is masked by a masker keyed per data subject and names no subject: a wiring mistake, refused before any entry. */
export class MissingDataSubjectError extends Error {
  constructor(field: string) {
    super(
      `The audited field "${field}" is masked by a masker keyed per data subject and names none: declare it masked("${field}", { subject: "<the field that holds the id of the person>" })`,
    );

    this.name = 'MissingDataSubjectError';
  }
}
