import { source } from './source';

/** A route of billing declaring `codes` in its `errors`, for the fixtures of `errors/known-code`: a code is written as a string, a member of a code list (`BillingCodes.UnknownInvoice`) as it is. */
export function errorsRoute(...codes: string[]): string {
  return source(
    "import { defineRoute } from '@ddd-ts-kit/http';",
    '',
    'export const issueInvoiceRoute = defineRoute(',
    `  { method: 'POST', path: '/invoices', errors: [${codes.map((code) => (code.includes('.') ? code : `'${code}'`)).join(', ')}], security: false },`,
    '  issue,',
    ');',
  );
}
