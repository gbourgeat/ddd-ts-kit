import type { Authorizer } from '@ddd-ts-kit/auth';
import { CustomAuthorizer } from '{{alias.platform}}/auth/custom-authorizer.js';
import { permissions } from '{{alias.platform}}/auth/permissions.js';

// TODO(platform): give the adapter what your model needs (a client of the service that decides, its mapping) instead of this table granting everything to the role "admin".
export function createAuthorizer(): Authorizer {
  return new CustomAuthorizer({ admin: permissions.all().map((permission) => permission.id) });
}
