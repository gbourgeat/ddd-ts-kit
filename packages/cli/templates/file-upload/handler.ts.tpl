import type { CommandHandler, FileStaging } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  constructor(private readonly staging: FileStaging) {}

  /** The file arrives staged and scanned; it reaches its key with the commit, and stays staged, then purged, on a rollback. */
  async execute(command: {{name.pascal}}Command): Promise<string> {
    const { file } = command.upload;

    // TODO(domain): record `file` (key, size, media type, checksum: never the content) on the aggregate "{{name.words}}" attaches it to, and save that aggregate here: the reference commits with the file.
    await this.staging.promoteOnCommit(file.key);

    return file.key;
  }
}
