const term = (row: string): string[] => ['--term', row];

/**
 * A use case of shipping no route reaches, started by the integration event its handler receives:
 * its end-to-end spec publishes that event through the running application, which a project
 * without HTTP has no support for.
 */
export function scaffoldShippingReaction(
  step: (...args: string[]) => void,
  withHttp: boolean,
  grant: (role: string) => string[],
): void {
  if (!withHttp) {
    return;
  }

  step(
    'generate',
    'command',
    'shipping',
    'ShipParcel',
    '--permission',
    'parcel.ship',
    ...grant('clerk'),
    ...term('Ship=To hand a parcel to a carrier'),
  );

  step('generate', 'e2e', 'shipping', 'ShipParcel', '--event', 'billing.invoice.issued');
}
