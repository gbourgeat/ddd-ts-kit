import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { EntryRepository } from '../../../domain/repositories/entry.repository.js';
import { PostEntry } from './post-entry.command.js';

@CommandHandler(PostEntry, [EntryRepository])
export class PostEntryHandler implements CommandHandler<PostEntry> {
  constructor(private readonly entries: EntryRepository) {}

  async execute(command: PostEntry): Promise<string> {
    const id = await this.entries.nextId();

    await this.entries.save({ id, account: command.account, postedBy: command.actor.id });

    return id;
  }
}
