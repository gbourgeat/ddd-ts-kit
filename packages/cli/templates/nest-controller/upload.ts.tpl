import { Controller, Inject, {{route.nestMethod}} } from '@nestjs/common';
import { {{upload.kitImports}} } from '@ddd-ts-kit/http';
import { {{upload.bridgeImports}} } from '@ddd-ts-kit/http/nest';
import { {{upload.kernelImports}} } from '@ddd-ts-kit/kernel';
{{route.imports}}

/** Built by Nest with the bus it injects, served by the kit: the file is streamed and checked by the kit, never parsed by Nest. */
@Controller()
@KitRoutes({ {{route.nestShared}} })
export class {{name.pascal}}Controller {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @{{route.nestMethod}}({{route.nestPath}})
  @KitRoute({
    // TODO(domain): the largest file and the media types "{{name.words}}" accepts: both are part of the contract, and the content is checked against them as it streams.
    upload: { field: 'file', maxBytes: 10_485_760, mediaTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
    response: { status: 201, description: 'Stored; the file is visible once the command has committed.' },
    // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
    errors: [],
  })
  async {{name.camel}}({{upload.parameters}}): Promise<void> {
    // TODO(domain): hand the command the identifier of what the file is attached to, from the parameters of the path.
    await this.commands.execute(new {{route.input}}({{upload.arguments}}));
  }
}
