/** The options keys that hold a name written once and never derived: the idempotency scope, the policy name. */
export const WRITTEN_NAMES: Readonly<Record<string, string>> = {
  IntegrationEventHandler: 'consumer',
  Policy: 'name',
};
