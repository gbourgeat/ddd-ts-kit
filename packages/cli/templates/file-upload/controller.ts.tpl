import { {{upload.httpImports}} } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
{{route.imports}}

@Controller({
  {{route.access}}
  method: '{{route.method}}',
  path: '{{route.groupPath}}',
  summary: '{{name.title}}',
  // TODO(domain): the largest file and the media types "{{name.words}}" accepts: both are part of the contract, and the content is checked against them as it streams.
{{#unless upload.isText}}
  upload: { field: 'file', maxBytes: 10_485_760, mediaTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
{{/unless}}
{{#if upload.isText}}
  upload: {
    field: 'file',
    maxBytes: 10_485_760,
    // A browser on Windows names a CSV `application/vnd.ms-excel`: the kit has no content rule for it, so the route states one.
    mediaTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
    text: '{{upload.text}}',
    contentRules: { 'application/vnd.ms-excel': 'text' },
  },
{{/if}}
  response: { status: 201, description: 'Stored; the file is visible once the command has committed.' },
  // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
  errors: [],
})
export class {{name.pascal}}Controller {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ upload: IncomingFile }>): Promise<void> {
    // TODO(domain): hand the command the identifier of what the file is attached to, from `request.params`.
    await this.commands.execute(new {{route.input}}({{#if route.protected}}request.actor, {{/if}}request.upload));
  }
}
