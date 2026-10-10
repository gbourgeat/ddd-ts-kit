export type PolicyVerdict = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };
