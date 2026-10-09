import type { Actored, Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuthorizationContext, ResourceRef } from './authorizer.js';
import { AuthorizationSetupError } from './errors.js';
import type { Permission } from './permissions.js';

export interface PublicUseCase {
  readonly access: 'public';
  readonly type: MessageType<Message>;
}

export interface ProtectedUseCase {
  readonly access: 'protected';
  readonly type: MessageType<Message>;
  readonly permission: Permission;
  resourceOf(message: Message): ResourceRef | undefined;
  contextOf(message: Message): AuthorizationContext | undefined;
}

export type UseCaseDeclaration = PublicUseCase | ProtectedUseCase;

export interface RequirementOptions<M> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourceRef;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => AuthorizationContext;
}

/**
 * Declares, next to the use case and without touching its handler, the permission a command
 * or query requires. The message must carry its actor, which the compiler checks.
 */
export function requires<M extends Message & Actored>(
  type: MessageType<M>,
  permission: Permission,
  options: RequirementOptions<M> = {},
): ProtectedUseCase {
  return {
    access: 'protected',
    type,
    permission,
    resourceOf: (message) => (message instanceof type ? options.resource?.(message) : undefined),
    contextOf: (message) => (message instanceof type ? options.context?.(message) : undefined),
  };
}

/** Declares that anybody may send the command or query, the anonymous caller included. */
export function publicUseCase(type: MessageType<Message>): PublicUseCase {
  return { access: 'public', type };
}

/** What each command and query requires. A message absent from it is refused: deny by default. */
export class AuthorizationMap {
  readonly #byType = new Map<unknown, UseCaseDeclaration>();

  static of(...declarations: readonly UseCaseDeclaration[]): AuthorizationMap {
    return new AuthorizationMap(declarations);
  }

  constructor(declarations: readonly UseCaseDeclaration[] = []) {
    for (const declaration of declarations) {
      if (this.#byType.has(declaration.type)) {
        throw new AuthorizationSetupError(`The access to ${declaration.type.name} is declared twice.`);
      }
      this.#byType.set(declaration.type, declaration);
    }
  }

  find(message: Message): UseCaseDeclaration | undefined {
    return this.#byType.get(message.constructor);
  }

  declarations(): readonly UseCaseDeclaration[] {
    return [...this.#byType.values()];
  }

  /** The maps of several contexts as one, for the composition root. */
  merge(...others: readonly AuthorizationMap[]): AuthorizationMap {
    return new AuthorizationMap([this, ...others].flatMap((map) => map.declarations()));
  }
}
