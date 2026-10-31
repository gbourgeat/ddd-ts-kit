/**
 * What the cipher opens a personal value into once the key that sealed it is gone: the id of that
 * key, never a text a person could have typed. `StoredEventData` reads it as `ERASED_PERSONAL_DATA`
 * with `text`, and as absent with its personal readers.
 */
export interface ErasedValue {
  readonly $erased: { readonly key: string };
}
