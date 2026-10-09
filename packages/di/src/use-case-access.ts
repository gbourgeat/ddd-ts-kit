import type { Message, MessageInfo, MessageType } from '@ddd-ts-kit/kernel';
import { declarationOf, type PermissionRef, type ResourcePointer } from '@ddd-ts-kit/kernel/declarations';

export type { PermissionRef, ResourcePointer };

export interface RequirementOptions<M> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourcePointer;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => Readonly<Record<string, unknown>>;
}

export type UseCaseAccess = 'public' | 'protected';

export interface UseCaseDeclaration {
  readonly kind: MessageInfo['kind'];
  readonly message: MessageType<Message>;
  readonly module: string;
  /** Absent when neither the module (`.requires(...)`, `.public()`) nor the message (`@Requires`, `@Public`) said it. */
  readonly access?: UseCaseAccess;
  readonly permission?: PermissionRef;
  readonly resourceOf?: (message: Message) => ResourcePointer | undefined;
  readonly contextOf?: (message: Message) => Readonly<Record<string, unknown>> | undefined;
}

export type Requirement = Pick<UseCaseDeclaration, 'access' | 'permission' | 'resourceOf' | 'contextOf'>;

export function protectedRequirement<M extends Message>(
  type: MessageType<M>,
  permission: PermissionRef,
  options: RequirementOptions<M> = {},
): Requirement {
  return {
    access: 'protected',
    permission,
    resourceOf: (message) => (message instanceof type ? options.resource?.(message) : undefined),
    contextOf: (message) => (message instanceof type ? options.context?.(message) : undefined),
  };
}

export const PUBLIC_REQUIREMENT: Requirement = { access: 'public' };

/** What the message says of itself with `@Requires` or `@Public`; nothing for an undecorated one. */
export function declaredRequirement(type: MessageType<Message>): Requirement {
  const declaration = declarationOf(type);
  if (declaration?.role !== 'message') return {};
  const { access, permission, resourceOf, contextOf } = declaration;
  return {
    access,
    ...(permission === undefined ? {} : { permission }),
    ...(resourceOf === undefined ? {} : { resourceOf }),
    ...(contextOf === undefined ? {} : { contextOf }),
  };
}
