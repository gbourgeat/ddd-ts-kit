/** `path` is dotted (`items.0.sku`); the empty string designates the input itself. */
export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};
