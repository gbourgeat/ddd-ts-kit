import type { Injection } from '../injection';

const IDENTITY = 'src/contexts/identity';
const IDENTITY_TABLES = `${IDENTITY}/infrastructure/persistence/create-identity-tables.schema.ts`;
const PAYLOAD = `${IDENTITY}/published-language/person-registered.v1.payload.ts`;
const PERSON_FIELDS = `${IDENTITY}/infrastructure/persistence/person.personal-fields.ts`;
const BOOKED = 'src/contexts/scheduling/published-language/appointment-booked.v1.integration-event.ts';
const OUTCOMES = 'src/contexts/analytics/application/projections/outcomes.projection.ts';
const MAILER = 'src/contexts/notification/infrastructure/external/remote-mailer.adapter.ts';

/** The privacy rules: what the example keeps of people is declared, erased where it is copied, and never logged. */
export const PRIVACY_INJECTIONS: readonly Injection[] = [
  {
    rule: 'privacy/declared-field',
    what: 'a phone number added to the persons of identity, which no declaration names',
    file: IDENTITY_TABLES,
    changes: [
      {
        file: IDENTITY_TABLES,
        from: "    table.text('email').notNullable();\n",
        to: "    table.text('email').notNullable();\n    table.text('phone');\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'privacy/event-payload-declared',
    what: 'a phone number added to the payload of identity.person.registered, which its personal option does not list',
    file: PAYLOAD,
    changes: [{ file: PAYLOAD, from: "  email = '';\n", to: "  email = '';\n\n  readonly phone?: string;\n" }],
    checker: true,
  },
  {
    rule: 'privacy/erasure-reaches-copies',
    what: 'scheduling.appointment.booked declared as carrying the day a patient comes, which analytics counts and nothing in analytics erases',
    file: OUTCOMES,
    changes: [
      {
        file: BOOKED,
        from: '  payload: classSchema(AppointmentBookedV1Payload),\n',
        to: "  personal: { subject: 'patientId', fields: ['day'] },\n  payload: classSchema(AppointmentBookedV1Payload),\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'privacy/subject-is-opaque',
    what: 'the persons of identity declared as named by their address',
    file: PERSON_FIELDS,
    changes: [{ file: PERSON_FIELDS, from: "  subject: 'id',\n", to: "  subject: 'email',\n" }],
    checker: true,
  },
  {
    rule: 'privacy/no-personal-data-in-logs',
    what: 'the development mailer logging an address under the name of the declared column of the contacts',
    file: MAILER,
    changes: [
      {
        file: MAILER,
        from: '      operation: call.operation,\n',
        to: '      operation: call.operation,\n      address: call.operation,\n',
      },
    ],
    checker: true,
  },
];
