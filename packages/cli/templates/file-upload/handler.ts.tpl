import type { CommandHandler, FileKeys, FileStaging } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  constructor(
    private readonly staging: FileStaging,
    private readonly keys: FileKeys,
  ) {}

  async execute(command: {{name.pascal}}Command): Promise<string> {
    const { stream, mediaType } = command.file;
    const file = await this.staging.stage(this.keys.next('{{name.kebab}}'), stream, { mediaType });

    // TODO(domain): record `file` (key, size, media type, checksum: never the content) on the aggregate "{{name.words}}" attaches it to, and save that aggregate here: the reference commits with the state change, and a rollback leaves the file staged, then purged.
    await this.staging.promoteAfterCommit(file.key);

    return file.key;
  }
}
