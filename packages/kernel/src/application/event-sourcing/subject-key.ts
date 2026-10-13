/** The key the personal data of one data subject is sealed with. Destroying it erases that data everywhere it was sealed. */
export interface SubjectKey {
  /** Written next to every value sealed with it, so a later key of the same subject never opens an older value. */
  readonly id: string;
  /** The data subject: whose personal data the key seals. */
  readonly subject: string;
  /** 32 bytes, base64. */
  readonly material: string;
}
