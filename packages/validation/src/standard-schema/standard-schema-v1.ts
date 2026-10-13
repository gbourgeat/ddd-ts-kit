/**
 * The subset of the Standard Schema v1 specification this adapter relies on, with the optional
 * converter of its companion specification, Standard JSON Schema v1.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
    readonly jsonSchema?: StandardJsonSchemaConverter | undefined;
  };
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] };

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/** What a library that implements Standard JSON Schema v1 converts its schemas with. */
export interface StandardJsonSchemaConverter {
  readonly input: (options: { readonly target: string }) => Record<string, unknown>;
  readonly output: (options: { readonly target: string }) => Record<string, unknown>;
}
