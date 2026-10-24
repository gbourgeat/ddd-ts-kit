import type { Change, Injection } from '../injection';

const CONFIG = 'ddd-ts-kit.config.json';
const IDENTITY = 'src/contexts/identity';
const IDENTITY_TABLES = `${IDENTITY}/infrastructure/persistence/create-identity-tables.schema.ts`;
const PAYLOAD = `${IDENTITY}/published-language/person-registered.v1.payload.ts`;
const EVENT = `${IDENTITY}/published-language/person-registered.v1.integration-event.ts`;
const PERSON_FIELDS = `${IDENTITY}/infrastructure/persistence/person.personal-fields.ts`;
const CONTACTS_FIELDS = 'src/contexts/notification/infrastructure/persistence/contact.personal-fields.ts';
const MAILER = 'src/contexts/notification/infrastructure/external/remote-mailer.adapter.ts';
const PROJECTION = 'src/contexts/notification/application/projections/contacts.projection.ts';

/**
 * The example with its platform answering the requests of a data subject, the words its columns
 * and its events already hold set aside: the erasure of the example is still written by hand
 * (part 0b of the proposal on privacy by design), its declarations come with part 11.
 */
const PRIVACY_ON: readonly Change[] = [
  { file: CONFIG, from: '    "audit": "on",\n', to: '    "audit": "on",\n    "privacy": "on",\n' },
  {
    file: CONFIG,
    from: '  "sourceRoot": "src",\n',
    to: '  "sourceRoot": "src",\n  "privacy": { "allow": ["email", "display_name", "address"] },\n',
  },
];

/** The privacy rules: what a project keeps of people is declared, and erased where it is copied. */
export const PRIVACY_INJECTIONS: readonly Injection[] = [
  {
    rule: 'privacy/declared-field',
    what: 'a phone number added to the persons of identity, which no declaration names',
    file: IDENTITY_TABLES,
    changes: [
      ...PRIVACY_ON,
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
    changes: [
      ...PRIVACY_ON,
      { file: PAYLOAD, from: "  email = '';\n", to: "  email = '';\n\n  readonly phone?: string;\n" },
    ],
    checker: true,
  },
  {
    rule: 'privacy/erasure-reaches-copies',
    what: 'identity.person.registered declared as carrying the email of the person, which the contacts of notification copy and nothing erases',
    file: PROJECTION,
    changes: [
      ...PRIVACY_ON,
      {
        file: EVENT,
        from: '  payload: classSchema(PersonRegisteredV1Payload),\n',
        to: "  personal: { subject: 'personId', fields: ['displayName', 'email'] },\n  payload: classSchema(PersonRegisteredV1Payload),\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'privacy/subject-is-opaque',
    what: 'a declaration of the persons of identity whose subject is their phone number',
    file: PERSON_FIELDS,
    changes: [
      ...PRIVACY_ON,
      {
        file: PERSON_FIELDS,
        to: "import { personalFields } from '@ddd-ts-kit/kernel';\n\n/** What the persons of identity keep of a person, named by the phone number. */\nexport const PersonPersonalFields = personalFields<{ readonly phone: string; readonly display_name: string }>(\n  { schema: 'identity', table: 'persons' },\n  { subject: 'phone', fields: ['display_name'], erasure: 'pseudonymise' },\n);\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'privacy/no-personal-data-in-logs',
    what: 'the address of a recipient, declared personal data, logged by the development mailer',
    file: MAILER,
    changes: [
      ...PRIVACY_ON,
      {
        file: CONTACTS_FIELDS,
        to: "import { personalFields } from '@ddd-ts-kit/kernel';\n\n/** What the contacts of notification keep of a person. */\nexport const ContactPersonalFields = personalFields<{ readonly recipient_id: string; readonly recipient_address: string }>(\n  { schema: 'notification', table: 'contacts' },\n  { subject: 'recipient_id', fields: ['recipient_address'], erasure: 'row' },\n);\n",
      },
      {
        file: MAILER,
        from: '      operation: call.operation,\n',
        to: '      operation: call.operation,\n      recipientAddress: call.operation,\n',
      },
    ],
    checker: true,
  },
];
