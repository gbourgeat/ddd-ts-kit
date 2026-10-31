import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const MAPPER = `${PATHS.BILLING}/infrastructure/persistence/dossier-snapshots.mapper.ts`;
const EVENTS = `${PATHS.BILLING}/infrastructure/persistence/dossier-events.mapper.ts`;

export const PRIVACY_SNAPSHOT_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot that seals what is named like personal data, on the write and the read side',
    expect: 'pass',
    files: privacyOn({
      [MAPPER]: source(
        'export const dossierSnapshots = {',
        '  version: 1,',
        '  encode: (dossier: Dossier): object => ({',
        '    email: dossier.email === undefined ? null : personalData(dossier.patientId, dossier.email),',
        '    birthDate: personalData(dossier.patientId, dossier.bornOn),',
        '  }),',
        '  decode: (data: StoredEventData): DossierState => ({',
        "    email: data.personalText('email'),",
        "    bornOn: data.text('birthDate'),",
        '  }),',
        '};',
      ),
    }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot that keeps nothing named like personal data, its key to the person included',
    expect: 'pass',
    files: privacyOn({ [MAPPER]: mapper('patientId: dossier.patientId,') }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot in clear, in a project whose privacy is off',
    expect: 'pass',
    files: project({ [MAPPER]: mapper('email: dossier.email,') }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a word the config allows, and one named in a comment only',
    expect: 'pass',
    files: privacyOn(
      { [MAPPER]: mapper('street: dossier.street, // email: stays in the event') },
      { privacy: { allow: ['street'] } },
    ),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'an event mapper, which another rule reads',
    expect: 'pass',
    files: privacyOn({ [EVENTS]: source('export const data = { surname: event.surname };') }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot whose encode writes an email in clear',
    expect: { file: MAPPER },
    files: privacyOn({ [MAPPER]: mapper('email: dossier.email ?? null,') }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot that writes the whole state, whose decode reads an email in clear',
    expect: { file: MAPPER },
    files: privacyOn({ [MAPPER]: mapperOfTheState("email: data.optionalText('email'),") }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a snapshot with a word of privacy.vocabulary in clear',
    expect: { file: MAPPER },
    files: privacyOn({ [MAPPER]: mapper('diagnosis: dossier.diagnosis,') }, { privacy: { vocabulary: ['diagnosis'] } }),
  },
  {
    ruleId: 'privacy/snapshot-sealed',
    name: 'a value sealed beside one written in clear',
    expect: { file: MAPPER },
    files: privacyOn({
      [MAPPER]: mapper('email: personalData(dossier.patientId, dossier.email),', 'phone: dossier.phone,'),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a key of a snapshot mapper read like a column, which is no column',
    expect: 'pass',
    files: privacyOn({
      [MAPPER]: source(
        'export const dossierSnapshots = {',
        '  version: 1,',
        '  encode: (dossier: Dossier): object => ({',
        '    phone: dossier.phone === undefined ? null : personalData(dossier.patientId, dossier.phone),',
        '  }),',
        "  decode: (data: StoredEventData): DossierState => ({ phone: data.text('phone') }),",
        '};',
      ),
    }),
  },
];

function privacyOn(files: FixtureFiles, written: Record<string, unknown> = {}): FixtureFiles {
  return project(files, { [CONFIG_FILE]: config({ stack: { privacy: 'on', orm: 'knex' }, ...written }) });
}

function mapper(...encoded: readonly string[]): string {
  return source(
    'export const dossierSnapshots = {',
    '  version: 1,',
    '  encode: (dossier: Dossier): object => ({',
    '    openedAt: dossier.openedAt.toISOString(),',
    ...encoded.map((line) => `    ${line}`),
    '  }),',
    '  decode: (data: StoredEventData): DossierState => ({',
    "    openedAt: data.instant('openedAt'),",
    '  }),',
    '};',
  );
}

/** The state written whole, so that only `decode` names what the snapshot keeps. */
function mapperOfTheState(read: string): string {
  return source(
    'export const dossierSnapshots = {',
    '  version: 1,',
    '  encode: (dossier: Dossier): object => dossier.toState(),',
    '  decode: (data: StoredEventData): DossierState => ({',
    `    ${read}`,
    '  }),',
    '};',
  );
}
