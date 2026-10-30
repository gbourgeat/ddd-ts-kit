/**
 * The keys of `Config` the parser derives from other keys and never reads from
 * ddd-ts-kit.config.json: written there, one is not read, and `config/valid` names it.
 */
export const DERIVED_CONFIG_KEYS: readonly string[] = ['payloadSchemaPackages'];
