/** What a constructor parameter says of a dependency: the class that types it, or why it names none. */
export type ParameterReading =
  | { readonly token: string; readonly flaw?: undefined }
  | { readonly flaw: string; readonly token?: undefined };
