import type { Config } from '../config';
import type { Relocation } from '../platform-folders/moved-specifier';

const FORMS_WITHOUT_HTTP =
  'Kept `forms: on` with `http: none`: no route serves a form until an HTTP framework is chosen (`npx ddd-ts-kit init --force --http <framework>`); `npx ddd-ts-kit init --force --forms off` records the choice.';

/** What init kept on a combination its defaults would not choose, said in a note so that exit code 0 hides nothing. */
export function keptCombinationNotes(config: Config, flat: Relocation): string[] {
  const { audit, orm, forms, http, eventSourcing } = config.stack;

  return [
    ...(audit === 'on' && orm === 'none' ? [auditWithoutOrm(auditFile(config, flat))] : []),
    ...(eventSourcing === 'on' && orm === 'none' ? [eventSourcingWithoutOrm(config.platformDir)] : []),
    ...(forms === 'on' && http === 'none' ? [FORMS_WITHOUT_HTTP] : []),
  ];
}

function auditWithoutOrm(file: string): string {
  return `Kept \`audit: on\` with \`orm: none\`: the entries of the audit trail live in the memory of the process and are lost when it stops, until ${file} answers its TODO(platform) with an adapter of your storage; \`npx ddd-ts-kit init --force --audit off\` leaves the trail out.`;
}

/** Where the file is written: in its folder, or flat where a version before the folders put it and --force keeps it. */
function auditFile(config: Config, flat: Relocation): string {
  const inFolder = `${config.platformDir}/audit/create-audit-trail`;

  return `${flat.moved.get(inFolder) ?? inFolder}.ts`;
}

function eventSourcingWithoutOrm(platformDir: string): string {
  return `Kept \`eventSourcing: on\` with \`orm: none\`: the event store is \`InMemoryEventStore\`, so the events of an event-sourced aggregate, their only record, are lost when the process stops, until ${platformDir}/database/open-persistence.ts binds a store of your storage; \`npx ddd-ts-kit init --force --orm <orm>\` keeps them in PostgreSQL.`;
}
