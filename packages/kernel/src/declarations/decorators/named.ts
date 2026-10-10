/** Refuses the empty string for the option `Key`: a name is written, never left blank. */
export type Named<Name extends string, Key extends string> = Name extends '' ? { readonly [K in Key]: never } : unknown;
