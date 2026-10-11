import { {{job.systemActorValueImport}}type CommandBus, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel';
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';

export class {{name.pascal}}Job implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    // TODO(domain): {{job.todo}}
{{#if job.ungranted}}
    // TODO(domain): {{job.grant}}
{{/if}}
    await this.commands.execute(new {{job.command}}Command({{job.arguments}}));
  }
}
