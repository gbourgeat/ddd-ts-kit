const term = (row: string): string[] => ['--term', row];

/** A second reaction to an event already handled, in each context, named as the design calls it rather than after the event. */
export function scaffoldNamedReactions(step: (...args: string[]) => void): void {
  step(
    'generate',
    'event-handler',
    'billing',
    'Invoice',
    'Issued',
    '--name',
    'ThankBuyer',
    ...term('Thank=To acknowledge an issued invoice to its buyer'),
    ...term('Buyer=Who an invoice is sent to'),
  );

  step(
    'generate',
    'integration-handler',
    'shipping',
    'billing',
    'billing.invoice.issued',
    '--name',
    'PackParcel',
    ...term('Pack=To put what was bought into a parcel'),
  );
}
