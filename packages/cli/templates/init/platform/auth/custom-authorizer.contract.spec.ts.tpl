import { beforeEach, describe, expect, it } from '{{tests.module}}';
import { definePermissions } from '@ddd-ts-kit/auth';
import { anActor, authorizerContract } from '@ddd-ts-kit/auth/testing';
import { CustomAuthorizer } from './custom-authorizer.js';

const permissions = definePermissions('contract', {
  'element.read': { description: 'Read an element' },
  'element.write': { description: 'Write an element' },
});

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'The custom authorizer',
    create: () => {
      const reader = anActor().named('ada').withRole('reader').build();

      return {
        authorizer: new CustomAuthorizer({ reader: [permissions['element.read'].id] }),
        granted: { actor: reader, permission: permissions['element.read'] },
        refused: { actor: reader, permission: permissions['element.write'] },
      };
    },
  },
);
