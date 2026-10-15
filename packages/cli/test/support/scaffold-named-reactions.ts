const term = (row: string): string[] => ['--term', row];

/**
 * A reaction named as the design calls it rather than after its event, so that the templates of a
 * domain event handler are compiled and checked under a name of their own. It reacts to the
 * payment of an invoice, off the path of the request whose whole trace the end-to-end proofs
 * assert. A named integration handler only changes where its name comes from: its own spec holds it.
 */
export function scaffoldNamedReactions(step: (...args: string[]) => void): void {
  step(
    'generate',
    'event-handler',
    'billing',
    'Invoice',
    'MarkedAsPaid',
    '--name',
    'ThankBuyer',
    ...term('Thank=To acknowledge a paid invoice to its buyer'),
    ...term('Buyer=Who an invoice is sent to'),
  );
}
