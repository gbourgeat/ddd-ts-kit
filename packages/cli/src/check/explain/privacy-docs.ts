import type { RuleDoc } from '../model/rule-doc';

const SILENT =
  'Judged only in a project whose platform answers the requests of a data subject (`stack.privacy: "on"`): a project that chose `off`, or whose config was written before the choice existed, said it keeps no personal data. A warning by default.';

export const PRIVACY_DOCS: Readonly<Record<string, RuleDoc>> = {
  'privacy/declared-field': {
    why: `The erasure, the export, the retention and the register of personal data read the personalFields declarations, never the columns: a column that holds a person and that no declaration names is a copy nobody erases, exports, purges or lists, and nothing fails. Judged on the name: a column of a table of a context (a Knex table, a Drizzle table, a TypeORM entity schema of its infrastructure/persistence/, a model of prisma/schema/ in the schema of the context) whose words hold a word of the vocabulary (email, phone, first_name, birth_date, address, iban, ip_address and the others of the kit, with privacy.vocabulary of the config added and privacy.allow removed) is named by a declaration of the same context, among its fields, its files or as its subject, in either spelling (customer_email or customerEmail). A name says nothing of what a text column holds: a notes column may hold a diagnosis, which the declarations of the project say, not the rule; a column added only by a migration written by hand is not read. ${SILENT}`,
    bad: `// contexts/billing/infrastructure/persistence/create-billing-tables.schema.ts
table.text('customer_email');
// and no billing/infrastructure/persistence/*.personal-fields.ts names it`,
    good: `// contexts/billing/infrastructure/persistence/invoice.personal-fields.ts
const declaration: PersonalFieldsOptions<InvoiceRow> = {
  subject: 'customer_id',
  fields: ['customer_email'],
  erasure: 'pseudonymise',
};
export const InvoicePersonalFields = personalFields(TABLE, declaration);
// a column that holds no person here (the address of a mailbox of the company):
// ddd-ts-kit-disable-next-line privacy/declared-field -- ADR-0012: the shared mailbox of the accounting team`,
  },
  'privacy/event-payload-declared': {
    why: `An integration event that carries personal data hands a copy of the person to every consumer. Its personal option says so: the event catalog prints it, AsyncAPI marks it (x-personal-data), the register lists the event and the contexts downstream, and privacy/erasure-reaches-copies asks those that consume it to erase their copy. A field of the payload whose name holds a word of the vocabulary and that the option does not list is a copy nobody knows of. Judged on the keys of the z.object of the declaration (the objects nested in it included) and on the members of the class or the interface of its .payload.ts; a path of the option is compared by its last name (customer.email lists email). The subject is the field that names the person, an opaque id. Minimisation first: a field no consumer needs leaves the payload. ${SILENT}`,
    bad: `export const customerRegisteredV1 = defineIntegrationEvent({
  type: 'crm.customer.registered',
  version: 1,
  payload: zodSchema(z.object({ customerId: z.string(), email: z.string() })),
});`,
    good: `export const customerRegisteredV1 = defineIntegrationEvent({
  type: 'crm.customer.registered',
  version: 1,
  personal: { subject: 'customerId', fields: ['email'] },
  payload: zodSchema(z.object({ customerId: z.string(), email: z.string() })),
});`,
  },
  'privacy/erasure-reaches-copies': {
    why: `A consumer of an event that carries personal data may keep a copy of the person (a contact, a read model, a denormalised name), and the erasure of the person has to reach it (GDPR article 17, and article 19 for the recipients). In the monolith, privacy:erase runs every PersonalDataErasure listed in src/platform/privacy/; a context run as a service of its own erases when the platform announces privacy.data-subject.erased. Judged: for every event whose personal option is declared, a context other than its producer whose application layer names the definition of the event (an integration handler, a projection, a process manager) declares a PersonalDataErasure (\`extends PersonalDataErasure\`) or handles privacy.data-subject.erased (dataSubjectErasedV1). A consumer that keeps nothing of the person, only reacts, records it. ${SILENT}`,
    bad: `// contexts/notification/application/projections/contacts.projection.ts
on(customerRegisteredV1, (event) => contacts.upsert(event.payload.customerId, event.payload.email));
// and notification declares no PersonalDataErasure`,
    good: `// npx ddd-ts-kit generate repository notification Contact --personal address
// writes contact.personal-fields.ts and the erasure of notification, which privacy:erase runs;
// as a service of its own: npx ddd-ts-kit generate erasure-handler notification`,
  },
  'privacy/subject-is-opaque': {
    why: `The subject names the person whose data a declaration or an event holds: the erasure looks the rows up by it and leaves it in place, the export and the audit trail name the person by it, the event store keys its cipher by it. An identifier that is itself personal data (an email, a phone number) survives the erasure of the person and is copied everywhere the person is named. Judged on the subject of every personalFields call of a context and of the personal option of every integration event: neither a word of the vocabulary nor one of the personal fields (the kernel refuses the second at start-up). ${SILENT}`,
    bad: `personalFields(TABLE, { subject: 'email', fields: ['display_name'], erasure: 'row' });`,
    good: `personalFields(TABLE, { subject: 'person_id', fields: ['email', 'display_name'], erasure: 'row' });`,
  },
  'privacy/no-personal-data-in-logs': {
    why: `A log line is copied, shipped, indexed and kept for months by systems the erasure never reaches, and read by people the person never dealt with; a metric with a label per person does the same. The opaque id of the person is enough to follow a request. An approximation at the level of the text: a name among the arguments of a call to the logger or to the metrics (logger.info(...), this.log.warn(...), metrics.increment(...)), an identifier, a property or a key, compared with the personal fields of the personalFields declarations and of the personal option of the integration events, in the files of the contexts and of the platform. A declared field of one word outside the vocabulary (name, label) is left out, too common to judge; a value reached through a variable of another name is not seen. Silent without a declaration. ${SILENT}`,
    bad: `this.logger.info('invoice sent', { invoiceId: invoice.id, customerEmail: invoice.customerEmail });`,
    good: `this.logger.info('invoice sent', { invoiceId: invoice.id, customerId: invoice.customerId });`,
  },
};
