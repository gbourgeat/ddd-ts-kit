/** Every problem of the environment at once, by variable name only: values may be secrets. */
export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super('Invalid configuration: ' + problems.join('; '));
    this.name = 'ConfigError';
  }
}
