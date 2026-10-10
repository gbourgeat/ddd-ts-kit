import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import type { Requirement } from './requirement.js';

/** What the message says of itself with `@Requires` or `@Public`; nothing for an undecorated one. */
export function declaredRequirement(type: MessageType<Message>): Requirement {
  const declaration = declarationOf(type);

  if (declaration?.role !== 'message') {
    return {};
  }

  const { access, permission, resourceOf, contextOf } = declaration;

  return {
    access,
    ...(permission === undefined ? {} : { permission }),
    ...(resourceOf === undefined ? {} : { resourceOf }),
    ...(contextOf === undefined ? {} : { contextOf }),
  };
}
