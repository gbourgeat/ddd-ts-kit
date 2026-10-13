import type { BackgroundJob, BackgroundJobExecution, CommandBus } from '@ddd-ts-kit/kernel';
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';

// TODO(domain): declare what "{{name.words}}" works on (identifiers, a period, never an aggregate), as plain JSON: a date travels as its ISO text.
export type {{name.pascal}}Payload = Readonly<Record<string, never>>;

export class {{name.pascal}}BackgroundJob implements BackgroundJob<{{name.pascal}}Payload> {
  static readonly jobName = '{{job.name}}';

  constructor(private readonly commands: CommandBus) {}

  async run(payload: {{name.pascal}}Payload, execution: BackgroundJobExecution): Promise<void> {
    // TODO(domain): {{job.todo}}
    await this.commands.execute(new {{job.command}}Command({{job.arguments}}));
  }
}
