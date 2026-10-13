/** One tuple as OpenFGA writes it: the subject is its `user`. */
export interface OpenFgaTupleKey {
  readonly user: string;
  readonly relation: string;
  readonly object: string;
}

/**
 * What the adapters of this package ask of an OpenFGA client, bound to one store: the subset of
 * the `OpenFgaClient` of `@openfga/sdk` they call, which that client fits as it is
 * (`openFgaClient` of `@ddd-ts-kit/openfga/sdk` builds one). Kept structural, so that this entry
 * imports nothing of the SDK and a test may give a double.
 */
export interface OpenFgaApi {
  check(body: OpenFgaTupleKey): Promise<{ readonly allowed?: boolean }>;
  listObjects(body: { readonly user: string; readonly relation: string; readonly type: string }): Promise<{
    readonly objects: readonly string[];
  }>;
  read(
    body: { readonly user?: string; readonly relation?: string; readonly object?: string },
    options?: { readonly continuationToken?: string; readonly pageSize?: number },
  ): Promise<{ readonly tuples: readonly { readonly key: OpenFgaTupleKey }[]; readonly continuation_token?: string }>;
  write(
    body: { readonly writes?: OpenFgaTupleKey[]; readonly deletes?: OpenFgaTupleKey[] },
    options?: {
      readonly conflict?: { readonly onDuplicateWrites?: string; readonly onMissingDeletes?: string };
      readonly transaction?: { readonly maxPerChunk?: number };
    },
  ): Promise<unknown>;
  readLatestAuthorizationModel(): Promise<{ readonly authorization_model?: unknown }>;
  writeAuthorizationModel(body: unknown): Promise<{ readonly authorization_model_id: string }>;
}
