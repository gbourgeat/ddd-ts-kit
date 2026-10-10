/**
 * Generated files carry marker comments delimiting the regions the generator may extend:
 * `// ddd-ts-kit:<region>` ... `// /ddd-ts-kit:<region>` (or the HTML comment form in Markdown).
 */
export function marker(region: string, closing: boolean): RegExp {
  return new RegExp(`^\\s*(?://|<!--)\\s*${closing ? '/' : ''}ddd-ts-kit:${region}\\s*(?:-->)?\\s*$`);
}
