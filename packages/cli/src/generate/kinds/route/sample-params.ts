import { toName } from '../../../naming';

/** The path parameters a spec sends, each named after itself: `{ invoiceId: 'invoice-id-1' }`, `{}` for none. */
export function sampleParams(parameters: readonly string[]): string {
  const sample = parameters.map((parameter) => `${parameter}: '${toName(parameter).kebab}-1'`).join(', ');

  return parameters.length > 0 ? `{ ${sample} }` : '{}';
}
