/** What an incoming content must be: one of the accepted media types, the one it declares, verified on its bytes. */
export interface ContentExpectation {
  readonly mediaType: string;
  readonly accepted: readonly string[];
}
