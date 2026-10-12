/**
 * One document of a split contract, as `ddd-ts-kit docs` writes it from `openapi.documents` of
 * the config: a route belongs to it when one of its route groups, one of its tags or its
 * operation id is listed (the operations of the contexts the config names, read from the sources).
 */
export interface OpenApiDocumentSelection {
  readonly name: string;
  readonly title?: string;
  readonly groups?: readonly string[];
  readonly tags?: readonly string[];
  readonly operations?: readonly string[];
}
