import { formatJson } from '../json/format-json';

/** The lists of knip.json depend on the stack: they are laid out as the formatter of the project would, whatever their length. */
export function laidOut(json: string): string {
  const value: unknown = JSON.parse(json);

  return formatJson(value);
}
