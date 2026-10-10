import type { Message } from '@ddd-ts-kit/kernel';
import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import type { UseCaseDeclaration } from './use-case-declaration.js';

/**
 * What each command and query requires. A message absent from it is refused: deny by default.
 * A value, not a port: the authorization module builds it from what the use cases declared
 * and binds it under this class.
 */
export class AuthorizationMap {
  static readonly tokenKey = 'auth.AuthorizationMap';

  private readonly byType = new Map<unknown, UseCaseDeclaration>();

  static of(...declarations: readonly UseCaseDeclaration[]): AuthorizationMap {
    return new AuthorizationMap(declarations);
  }

  constructor(declarations: readonly UseCaseDeclaration[] = []) {
    for (const declaration of declarations) {
      if (this.byType.has(declaration.type)) {
        throw new AuthorizationSetupError(`The access to ${declaration.type.name} is declared twice.`);
      }

      this.byType.set(declaration.type, declaration);
    }
  }

  find(message: Message): UseCaseDeclaration | undefined {
    return this.byType.get(message.constructor);
  }

  declarations(): readonly UseCaseDeclaration[] {
    return [...this.byType.values()];
  }

  /** The maps of several contexts as one, for the composition root. */
  merge(...others: readonly AuthorizationMap[]): AuthorizationMap {
    return new AuthorizationMap([this, ...others].flatMap((map) => map.declarations()));
  }
}
