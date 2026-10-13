{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { OpenOrganisationBody } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.body{{alias.ext}}';
import { OpenOrganisationAccepted } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const body = classSchema(OpenOrganisationBody);
const accepted = classSchema(OpenOrganisationAccepted);
{{/if}}
{{#if validation.zod}}
const body = zodSchema(
  z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Open an organisation',
  body,
  response: { status: 201, description: 'Opened; the body carries its slug, the caller is its first owner.', body: accepted },
  errors: [
    'ACCOUNT_NOT_FOUND',
    'ACCOUNT_DEACTIVATED',
    'ORGANISATION_SLUG_TAKEN',
    'INVALID_ORGANISATION_SLUG',
    'INVALID_ORGANISATION_NAME',
  ],
})
export class OpenOrganisationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: OpenOrganisationBody }>): Promise<OpenOrganisationAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new OpenOrganisationCommand(request.actor, request.body));

    return { id };
  }
}
