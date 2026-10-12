/** A class used as an injection token, and where a generated file imports it from. */
export interface TokenReference {
  /** The name the class is exported under. */
  readonly name: string;
  /** A package, by the specifier the source wrote, or a file of the project, by its path from the root. */
  readonly from:
    | { readonly kind: 'package'; readonly specifier: string }
    | { readonly kind: 'file'; readonly path: string };
}
