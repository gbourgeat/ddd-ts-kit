/** Where an operation sits in its document: its method and path, the parameters of its path item, the security of the document. */
export interface OperationPlace {
  readonly method: string;
  readonly path: string;
  readonly shared: readonly unknown[];
  readonly security: unknown;
}
