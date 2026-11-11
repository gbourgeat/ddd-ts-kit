import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';

const CREDENTIALS = 'test/e2e/support/create-credentials.ts';
const ROLE = 'src/platform/auth/authorization/role.ts';
const SPEC = 'test/e2e/place-order.e2e.spec.ts';
const ROLE_IMPORT = "import type { Role } from '@/platform/auth/authorization/role';";

/** Each authenticator `init` writes the credentials of a test for, with the flags it needs beside it. */
const AUTHENTICATORS: readonly (readonly [string, readonly string[]])[] = [
  ['none', []],
  ['jwt', []],
  ['keycloak', []],
  ['passport', ['--http', 'nest', '--di', 'nest', '--validation', 'class-validator', '--routes', 'nest']],
];

describe.each(AUTHENTICATORS)('the actor of an end-to-end test, under --authn %s', (authn, more) => {
  it.each(['rbac', 'abac'])('holds roles of the vocabulary of the platform alone, under --authz %s', (authz) => {
    const root = initProject('--authn', authn, '--authz', authz, ...more);
    const credentials = read(root, CREDENTIALS);

    expect(exists(root, ROLE)).toBe(true);
    expect(credentials).toContain(ROLE_IMPORT);

    expect(credentials).toContain(
      '  readonly id: string;\n  readonly roles?: readonly Role[];\n  readonly tenantId?: string;',
    );

    expect(credentials).toContain('A role is one the platform declares (`Role.Admin`): another does not compile. */');
    expect(credentials).not.toContain('readonly string[]');
  });

  it.each(['rebac', 'custom'])(
    'holds roles written as strings where the platform declares none, under --authz %s',
    (authz) => {
      const root = initProject('--authn', authn, '--authz', authz, ...more);
      const credentials = read(root, CREDENTIALS);

      expect(exists(root, ROLE)).toBe(false);

      expect(credentials).toContain(
        '  readonly id: string;\n  readonly roles?: readonly string[];\n  readonly tenantId?: string;',
      );

      expect(credentials).not.toContain('Role');
    },
  );
});

/** A project with a protected route to drive, then what `prepare` does to it before its end-to-end spec is generated. */
function specOf(flags: readonly string[], prepare: (root: string) => void = () => undefined): string {
  const root = initProject(...flags, '--context', 'ordering:core');
  const run = (...args: string[]) => expect(cli(root, 'generate', ...args).code).toBe(0);

  run('aggregate', 'ordering', 'Order', '--term', 'Order=A purchase');
  run('repository', 'ordering', 'Order');

  run(
    'command',
    'ordering',
    'PlaceOrder',
    '--permission',
    'order.place',
    '--aggregate',
    'Order',
    '--creates',
    '--term',
    'Place=Record',
  );

  run('route', 'ordering', 'PlaceOrder', '--method', 'POST', '--path', '/orders', '--command');
  prepare(root);
  run('e2e', 'ordering', 'PlaceOrder');

  return read(root, SPEC);
}

describe('generate e2e, the role of the actor it calls as', () => {
  it('names the administrator of the role vocabulary, imported before the support of the spec', () => {
    const spec = specOf([]);

    expect(spec.match(/application\.as\(\{ id: 'ada', roles: \[Role\.Admin\] \}\)/g)).toHaveLength(2);

    expect(spec).toContain(
      "import { Role } from '@/platform/auth/authorization/role';\nimport { startApplication, type RunningApplication } from '$test/e2e/support/start-application';",
    );

    expect(spec).not.toContain("'admin'");
  });

  it('names the first role of a vocabulary that holds no administrator', () => {
    const spec = specOf([], (root) => {
      write(root, ROLE, read(root, ROLE).replace("  Admin: 'admin',\n", "  Clerk: 'clerk',\n"));
    });

    expect(spec.match(/roles: \[Role\.Clerk\]/g)).toHaveLength(2);
  });

  it('writes the role as a string where the platform declares no role', () => {
    const spec = specOf(['--authz', 'rebac']);

    expect(spec.match(/roles: \['admin'\] \}/g)).toHaveLength(2);
    expect(spec).not.toContain('Role');
  });
});
