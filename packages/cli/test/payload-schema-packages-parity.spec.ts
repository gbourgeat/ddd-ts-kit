import { describe, expect, it } from 'vitest';
import { parseConfig as parseLintedConfig } from '../../eslint-plugin/src/project/parse-config';
import { payloadSchemaPackagesOf } from '../src/config/payload-schema-packages-of';

/**
 * What the file of a background job may import for its payload schema, by the validation
 * library of the stack: the CLI and the ESLint plugin keep their copy, the plugin depending on
 * nothing of the CLI, and this spec holds them equal (the dependency-cruiser script of the
 * pipeline is held to the CLI by the spec of depcruise-config).
 */
describe('the packages of the payload schema of a background job', () => {
  it.each(['zod', 'class-validator', 'typebox', 'standard-schema', 'none'])(
    'are the same under %s for the checker and for the ESLint plugin',
    (validation) => {
      expect(parseLintedConfig({ stack: { validation } }).payloadSchemaPackages).toEqual(
        payloadSchemaPackagesOf(validation),
      );
    },
  );
});
