/** A userset rewrite of OpenFGA, as its API writes it (schema 1.1). */
export interface OpenFgaUserset {
  readonly this?: Record<string, never>;
  readonly computedUserset?: { readonly relation: string };
  readonly tupleToUserset?: {
    readonly tupleset: { readonly relation: string };
    readonly computedUserset: { readonly relation: string };
  };
  readonly union?: { readonly child: readonly OpenFgaUserset[] };
  readonly intersection?: { readonly child: readonly OpenFgaUserset[] };
  readonly difference?: { readonly base: OpenFgaUserset; readonly subtract: OpenFgaUserset };
}

/** Who may be the subject of a directly assignable relation: a type, or the userset `<type>#<relation>`. */
export interface OpenFgaRelationReference {
  readonly type: string;
  readonly relation?: string;
}

export interface OpenFgaTypeDefinition {
  readonly type: string;
  readonly relations?: Readonly<Record<string, OpenFgaUserset>>;
  readonly metadata?: {
    readonly relations?: Readonly<
      Record<string, { readonly directly_related_user_types?: readonly OpenFgaRelationReference[] }>
    >;
  };
}

/** The body of `WriteAuthorizationModel`: what `authorizationModelOf` generates from a relationship schema. */
export interface OpenFgaModel {
  readonly schema_version: '1.1';
  readonly type_definitions: readonly OpenFgaTypeDefinition[];
}
