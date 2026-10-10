import { CommandBus{{job.systemActorImport}} } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { {{job.command}}Command } from '../commands/{{job.commandKebab}}/{{job.commandKebab}}.command.js';

@Scheduled('{{job.name}}', {{job.schedule}}, [CommandBus])
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
