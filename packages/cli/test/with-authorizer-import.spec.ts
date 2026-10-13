import { describe, expect, it } from 'vitest';
import { withAuthorizerImport } from '../src/presets/with-authorizer-import.js';

const MEMBER = 'SignedInGrantsAuthorizer';

describe('withAuthorizerImport', () => {
  it('adds the member to the import of the package, values first, then types', () => {
    const source = "import { RoleBasedAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';\n";

    expect(withAuthorizerImport(source, MEMBER)).toBe(
      "import { RoleBasedAuthorizer, SignedInGrantsAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';\n",
    );
  });

  it('turns an import of types only into one of values and types', () => {
    const source = "import type { Authorizer } from '@ddd-ts-kit/auth';\n";

    expect(withAuthorizerImport(source, MEMBER)).toBe(
      "import { SignedInGrantsAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';\n",
    );
  });

  it('writes the import when the source has none from the package', () => {
    expect(withAuthorizerImport('export const model = 1;\n', MEMBER)).toBe(
      "import { SignedInGrantsAuthorizer } from '@ddd-ts-kit/auth';\nexport const model = 1;\n",
    );
  });
});
