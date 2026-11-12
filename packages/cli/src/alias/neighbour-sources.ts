/**
 * What lets the compiler read an import that ends with `.ts`, which the files of `test/support/`
 * write to their neighbours under "importExtension": "js". `allowImportingTsExtensions` is only
 * accepted by a configuration that emits nothing: the type check takes both, and the build sets
 * both back, so that it emits what it emitted without them.
 */
export const NEIGHBOUR_SOURCES = {
  typeCheck: { allowImportingTsExtensions: true, noEmit: true },
  build: { allowImportingTsExtensions: false, noEmit: false },
} as const;
