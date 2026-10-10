import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

export class CreateDocument extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly workspaceId: string,
    readonly title: string,
  ) {
    super(actor);
  }
}
