import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';

const CONTEXT = 'src/contexts/identity';

describe('the identity preset in the explicit style', () => {
  it('lists every binding of the context in its module file, the checker finding nothing to report', () => {
    const root = initProject('--di', 'manual', '--http', 'fastify', '--preset', 'identity');
    const module = read(root, `${CONTEXT}/identity.module.ts`);

    expect(module).toContain('new InviteMemberHandler(invitations, members, delegations, tokens, access, ids, clock),');
    expect(module).toContain("requires(InviteMemberCommand, identityPermissions['member.invite'], IN_THE_CONTEXT),");
    expect(module).toContain('on(memberJoinedV1, (event) => memberJoinedIntegrationHandler.handle(event), {');
    expect(module).toContain('...controllerRoutes([new SearchMembersController(platform.queries)]),');
    expect(module).toContain('// ddd-ts-kit:registrations');
    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings');
  });

  it('writes its classes without the declarations of the kernel, its policies listed by the platform', () => {
    const root = initProject('--di', 'manual', '--http', 'fastify', '--preset', 'identity');
    const command = read(root, `${CONTEXT}/application/commands/invite-member/invite-member.command.ts`);
    const policy = read(root, `${CONTEXT}/application/authorization/invite-members.policy.ts`);

    expect(command).not.toContain('@ddd-ts-kit/kernel/declarations');
    expect(command).not.toContain('@Requires(');
    expect(policy).toContain("readonly permission = identityPermissions['member.invite'];");
    expect(read(root, 'src/platform/auth/authorization/access-policies.ts')).toContain('new InviteMembersPolicy(),');
    expect(fs.existsSync(path.join(root, `${CONTEXT}/identity.declarations.ts`))).toBe(false);
  });

  it('is written under Nest, its routes mounted with those of the other contexts', () => {
    const root = initProject('--http', 'nest', '--di', 'nest', '--preset', 'identity');

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain('identityModule,');
    expect(read(root, `${CONTEXT}/identity.module.ts`)).toContain('export function identityModule(platform: Platform)');
  });

  it('is refused in the explicit style on tsyringe, which declares its context instead', () => {
    const failure = initFailure('--style', 'explicit', '--preset', 'identity');

    expect(failure.message).toBe(
      'The identity preset is not written for "stack.style": "explicit" with "stack.di": "tsyringe".',
    );

    expect(failure.fix).toContain('--di manual and --di nest');
  });
});
