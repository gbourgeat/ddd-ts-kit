import { SAMPLES } from './samples.js';

/** The declaration of one version of the invoice-issued integration event, under the event type given. */
export function declaration(type: string, version = 1, payload: string = SAMPLES.PAYLOAD): string {
  return `export const invoiceIssuedV${version} = defineIntegrationEvent({ type: '${type}', version: ${version}, ${payload} });\n`;
}
