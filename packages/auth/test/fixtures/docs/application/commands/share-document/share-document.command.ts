import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

export class ShareDocument extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly documentId: string,
    readonly groupId: string,
  ) {
    super(actor);
  }
}
