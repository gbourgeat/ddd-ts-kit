import type { RuleDoc } from '../model/rule-doc';

export const SCHEMA_DOCS: Readonly<Record<string, RuleDoc>> = {
  'schema/presentation-only': {
    why: 'A schema says what a client sends or receives: it is a presentation type, and it changes with the contract, not with the model. The shared kernel is imported by every layer of every context, so a schema written there reaches the domain and the use cases, which then depend on the shape of a request. A schema shared by several contexts therefore lives under presentation/ of the shared kernel, and only presentation layers import it; a schema of one context lives in its presentation layer (domain/ and application/ are already refused any validation library by the layer rules). Judged: in the shared kernel outside presentation/, an import of a validation library (zod, class-validator, class-transformer, class-validator-jsonschema, valibot, arktype, TypeBox, @ddd-ts-kit/validation); in domain/, application/, infrastructure/ and published-language/ of a context, and in the shared kernel outside presentation/, an import of a file of presentation/ of the shared kernel. Specs are not judged. Judged under "stack.schemas": "shared" only.',
    bad: `// shared-kernel/money.ts
import { IsInt, IsString } from 'class-validator';
export class MoneyDto { @IsInt() cents = 0; @IsString() currency = ''; }
// contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts
import { MoneyDto } from '@/shared-kernel/presentation/money.schema';`,
    good: `// shared-kernel/presentation/money.schema.ts
export class Money { @IsInt() cents = 0; @IsString() currency = ''; }
// contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.mapper.ts
import type { Money } from '@/shared-kernel/presentation/money.schema';
// maps Money to the command, which carries plain values`,
  },
  'schema/no-duplicate-shape': {
    why: 'Two routes that declare the same shape by hand document it twice, as two unrelated schemas: the contract grows a copy per route, a client SDK generates two types for one thing, and the day the shape changes one copy is forgotten. Declared once and shared, it lands once in components.schemas and every route points at it with $ref; a route that needs a part of it derives that part (pick, omit, partial, extend) from the one declaration. Judged within one context, and between a context and presentation/ of the shared kernel: two contexts may declare the same structure, because an equal shape with two meanings is two concepts and sharing it would couple contexts that stay extractable. Compared: a DTO class (a class of the module that extends nothing, has no method and decorates each property), compared by its property names, their decorators with their arguments and whether each is optional; and the object of a schema builder (`z.object({...})`, `v.object({...})`, `Type.Object({...})`), compared by its entries whatever their order and layout. Empty shapes, shapes that still carry a TODO(domain) of the generator (every search line starts as `{ id }`) or a TODO(review), *.params.ts, *.query.ts and *.headers.ts files and the objects assigned to params, query or headers are not judged: a request parameter is documented per operation, never as a component. The original is the declaration of the shared kernel, then the one under presentation/http/shared/ of the context, then the first in path order; each copy is reported with the place of the original. Judged under "stack.schemas": "shared" only.',
    bad: `// appointments/cancel-appointment/cancel-appointment.accepted.ts
export class CancelAppointmentAccepted { @IsString() id = ''; }
// appointments/confirm-appointment/confirm-appointment.accepted.ts
export class ConfirmAppointmentAccepted { @IsString() id = ''; }`,
    good: `// both controllers answer with the identifier schema of the platform
import { acceptedSchema, type Accepted } from '@ddd-ts-kit/http';
response: { status: 201, description: 'Done.', body: acceptedSchema },
// a shape of the context, declared once: presentation/http/shared/slot.schema.ts
export const slotSchema = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });`,
  },
};
