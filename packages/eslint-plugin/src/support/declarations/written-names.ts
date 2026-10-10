/** The options keys that hold a name written once and never derived: the idempotency scope, the policy name, the event name. */
export const WRITTEN_NAMES: Readonly<Record<string, string>> = { IntegrationEventHandler: 'consumer', DomainEventHandler: 'name', Policy: 'name' };
