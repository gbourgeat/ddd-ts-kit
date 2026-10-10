/**
 * The export condition under which an alias resolves to the TypeScript source. Every tool that
 * reads or runs the sources sets it (the dev runner, the test runner, dependency-cruiser);
 * `node` in production sets none and takes the compiled file.
 */
export const SOURCE_CONDITION = 'ddd-ts-kit-source';
