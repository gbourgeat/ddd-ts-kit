import type { UseCaseDeclaration as DeclaredUseCase } from '@ddd-ts-kit/di';
import { AuthorizationSetupError } from '../errors/authorization-setup-error';
import { isPermission } from '../permissions/is-permission';
import { AuthorizationMap } from '../use-cases/authorization-map';
import { publicUseCase } from '../use-cases/public-use-case';
import type { UseCaseDeclaration } from '../use-cases/use-case-declaration';

/** A use case that declared nothing is left out, hence refused when it is sent. */
export function authorizationMapOf(declared: readonly DeclaredUseCase[]): AuthorizationMap {
  return new AuthorizationMap(declared.flatMap(declarationOf));
}

function declarationOf(declared: DeclaredUseCase): UseCaseDeclaration[] {
  if (declared.access === undefined) {
    return [];
  }

  if (declared.access === 'public') {
    return [publicUseCase(declared.message)];
  }

  const { permission } = declared;

  if (!isPermission(permission)) {
    throw new AuthorizationSetupError(
      `Module "${declared.module}" protects ${declared.message.name} with something that is not a permission made by definePermissions.`,
    );
  }

  return [
    {
      access: 'protected',
      type: declared.message,
      permission,
      resourceOf: (message) => declared.resourceOf?.(message),
      contextOf: (message) => declared.contextOf?.(message),
    },
  ];
}
