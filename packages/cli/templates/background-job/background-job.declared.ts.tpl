{{#if job.hasLibraryImports}}
{{job.libraryImports}}
{{/if}}
{{job.kernelImport}}
import { Background } from '@ddd-ts-kit/kernel/declarations';
{{#if job.hasKitImports}}
{{job.kitImports}}
{{/if}}
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';

{{job.payloadDeclaration}}

@Background()
export class {{name.pascal}}BackgroundJob implements BackgroundJob<{{name.pascal}}Payload> {
  static readonly jobName = '{{job.name}}';

  static readonly payload = {{job.payloadSchema}};

  constructor(private readonly commands: CommandBus) {}

  async run(payload: {{name.pascal}}Payload, execution: BackgroundJobExecution): Promise<void> {
    // TODO(domain): {{job.todo}}
    await this.commands.execute(new {{job.command}}Command({{job.arguments}}));
  }
}
{{#if job.hasPayloadHelpers}}

{{job.payloadHelpers}}
{{/if}}
