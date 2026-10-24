/**
 * The data subject of a masked field is not an opaque identifier: refused before any key is
 * created, since the key store writes the subject in clear and a declaration that named an email
 * or a name as the subject would put it there. The value is not repeated, it may be personal.
 */
export class MaskingSubjectNotAnIdError extends Error {
  constructor(field: string) {
    super(
      `The data subject of the masked field "${field}" is not an opaque identifier (letters, digits, "_" and "-", 63 at most): a name or an email would be written into the key store. Name the field that holds the id of the person`,
    );

    this.name = 'MaskingSubjectNotAnIdError';
  }
}
