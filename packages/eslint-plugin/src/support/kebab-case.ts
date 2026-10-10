/**
 * `RabbitMqEventBus` is `rabbit-mq-event-bus`, `StandardSchemaV1` is `standard-schema-v1`,
 * `HTTPServer` is `http-server`, `NO_POLICY` is `no-policy`: a name is written in a file name
 * the way its declaration spells it.
 */
export function kebabCase(name: string): string {
  return name
    .replaceAll('_', '-')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
