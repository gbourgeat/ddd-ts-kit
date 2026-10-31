/** A marker of a generated region, `// ddd-ts-kit:<region>` or `<!-- ddd-ts-kit:<region> -->`, opening or closing. */
export const REGION_MARKER = /^\s*(?:\/\/|<!--)\s*(\/?)ddd-ts-kit:([a-z][a-z0-9-]*)\s*(?:-->)?\s*$/;
