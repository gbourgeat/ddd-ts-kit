/**
 * The kebab-case of a name: a hyphen before an upper-case letter that follows a lower-case letter
 * or a digit, and before an upper-case letter followed by a lower-case one when it follows an
 * upper-case one; underscores read as hyphens; everything lower-cased. `RabbitMqEventBus` is
 * `rabbit-mq-event-bus`, `HTTPServer` is `http-server`, `RULE_DOCS` is `rule-docs`.
 */
export function kebabCaseOf(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_+/g, '-')
    .toLowerCase();
}
