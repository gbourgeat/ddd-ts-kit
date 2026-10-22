import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { EntryRepository } from '../../../domain/repositories/entry.repository';
import { PostEntry } from './post-entry.command';

@CommandHandler(PostEntry)
export class PostEntryHandler implements CommandHandler<PostEntry> {
  constructor(private readonly entries: EntryRepository) {}

  async execute(command: PostEntry): Promise<string> {
    const id = await this.entries.nextId();

    await this.entries.save({ id, account: command.account, postedBy: command.actor.id });

    return id;
  }
}
