import type { Injection } from '../injection';
import { PATHS } from '../paths';

const APPOINTMENTS = `${PATHS.SCHEDULING}/calendars/presentation/http/appointments`;
const COMPLETE_BODY = `${APPOINTMENTS}/complete-appointment/complete-appointment.body.ts`;
const LOOSE_SCHEMA = 'src/shared-kernel/money.ts';

/** Where the schemas of the contract live, and that a shape is declared once. */
export const SCHEMA_INJECTIONS: readonly Injection[] = [
  {
    rule: 'schema/presentation-only',
    what: 'a schema declared in the shared kernel outside presentation/',
    file: LOOSE_SCHEMA,
    changes: [
      {
        file: LOOSE_SCHEMA,
        to: "import { IsInt } from 'class-validator';\n\nexport class Money {\n  @IsInt()\n  cents = 0;\n}\n",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/schema-presentation-only',
  },
  {
    rule: 'schema/no-duplicate-shape',
    what: 'a body declaring by hand the shape the body of another route declares',
    file: COMPLETE_BODY,
    changes: [
      {
        file: COMPLETE_BODY,
        to: "import { IsOptional, IsString, MaxLength } from 'class-validator';\n\nexport class CompleteAppointmentBody {\n  @IsOptional()\n  @IsString()\n  @MaxLength(500)\n  reason?: string;\n}\n",
      },
    ],
    checker: true,
  },
];
