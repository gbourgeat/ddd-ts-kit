import { Command } from '../messaging/command';
import type { Actor } from './actor';
import type { Actored } from './actored';

/**
 * A command that somebody must be allowed to send. The actor is the first constructor
 * argument, so a call site cannot forget it; `Command` stays for public use cases.
 */
export abstract class AuthorizedCommand<R = void> extends Command<R> implements Actored {
  constructor(readonly actor: Actor) {
    super();
  }
}
