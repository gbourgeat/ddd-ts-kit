import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

const CONTEXT = 'src/contexts/identity';

describe('a deactivated account in a project with the identity preset', () => {
  it('is said to keep the rights its token names elsewhere until that token expires', () => {
    const root = initProject('--preset', 'identity');

    expect(read(root, `${CONTEXT}/CONTEXT.md`)).toContain(
      'This context refuses the account at once, the other contexts at its next token: they read the\ntoken, and a token already issued lives until it expires (300 s in the realm of the kit). A\nproject that wants no window checks the account at the edge.',
    );

    expect(read(root, `${CONTEXT}/application/commands/deactivate-account/deactivate-account.handler.ts`)).toContain(
      '   * every delegation it gave or received there, in the same unit of work. This context refuses the\n   * account at once; the other contexts read the token, so they refuse it at its next token: a\n   * token already issued lives until it expires (300 s in the realm of the kit). A project that\n   * wants no window checks the account at the edge.',
    );
  });
});
