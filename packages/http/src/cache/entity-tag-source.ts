/**
 * What names the version of an answer, for a conditional request: `representation`, a strong
 * tag hashed from the bytes answered; `{ version: field }`, a weak tag made of the version the
 * body carries under that field (the version of the read model or of the aggregate it shows).
 */
export type EntityTagSource = 'representation' | { readonly version: string };
