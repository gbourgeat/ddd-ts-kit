import { readStoredEventsLock, type StoredEventsLock } from '../event-sourcing/read-stored-events-lock.js';
import type { StoredEventDeclaration } from '../event-sourcing/stored-event-declaration.js';
import { storedEventDeclarations } from '../event-sourcing/stored-event-declarations.js';
import { STORED_EVENTS_LOCK } from '../event-sourcing/stored-events-lock-file.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';

const NEW_VERSION_FIX =
  'A stored event is never rewritten: keep the shape of the stored version as it is, declare the new shape under a new name, raise `version` by one and add the upcaster from the stored version, `upcasters: { <stored>: (data) => ({ ...data, <new field>: <value for the old events> }) }`, then `ddd-ts-kit docs --stored-events` records the new version once it is stored.';

export const eventSourcingUpcasterRequired: Rule = {
  id: 'event-sourcing/upcaster-required',
  description: `A stored event names the type of its data in \`encode\` and declares it, with every named type it reaches, in its codec file; a version above 1 has an upcaster from each version below; and the shape of a version recorded in ${STORED_EVENTS_LOCK} never changes.`,
  scope: 'file',
  run(project) {
    const lock = readStoredEventsLock(project.root);

    return perFile(project, this.id, (file) =>
      storedEventDeclarations(file).flatMap((declaration) => [
        ...unnamed(declaration),
        ...unresolved(declaration),
        ...missingUpcasters(declaration),
        ...changedShape(declaration, lock),
      ]),
    );
  },
};

function unnamed({ eventClass, payloadType, fingerprint, line }: StoredEventDeclaration): Finding[] {
  if (payloadType === undefined) {
    return [
      {
        line,
        message: `The encode of ${eventClass} does not name the type of the data it stores.`,
        fix: 'Write the stored shape as a named type in this file and answer it from encode: `encode: (event): InvoiceIssuedData => ({ ... })`. That type is what a later change is compared with.',
      },
    ];
  }

  return fingerprint === undefined
    ? [
        {
          line,
          message: `${payloadType}, the data of ${eventClass}, is not declared in this file.`,
          fix: `Declare \`interface ${payloadType} { ... }\` in the codec file, next to the events it stores: it is the stored shape, kept even when the domain event changes.`,
        },
      ]
    : [];
}

function unresolved({ eventClass, payloadType, unresolved: names, line }: StoredEventDeclaration): Finding[] {
  return names.map((name) => ({
    line,
    message: `${name}, reached by ${payloadType ?? 'the data'} of ${eventClass}, is not declared in this file: a change of it would change the stored shape unseen.`,
    fix: `Declare the stored shape of ${name} in the codec file too (\`interface ${name}Data { ... }\`, mapped from the domain type in encode), so that its fields are part of the fingerprint of the version.`,
  }));
}

function missingUpcasters({ eventClass, version, upcasters, line }: StoredEventDeclaration): Finding[] {
  if (version === undefined) {
    return [];
  }

  return Array.from({ length: version - 1 }, (_, index) => index + 1)
    .filter((from) => !upcasters.includes(from))
    .map((from) => ({
      line,
      message: `${eventClass} is stored in version ${version} and has no upcaster from version ${from}.`,
      fix: `Add \`upcasters: { ${from}: (data) => ({ ...data }) }\` turning the data of version ${from} into version ${from + 1}: events stored in version ${from} are read through it.`,
    }));
}

function changedShape(declaration: StoredEventDeclaration, lock: StoredEventsLock): Finding[] {
  const { name, eventClass, version, fingerprint, line } = declaration;
  const recorded = name === undefined ? {} : (lock[name] ?? {});
  const latest = Math.max(0, ...Object.keys(recorded).map(Number));

  if (version !== undefined && version < latest) {
    return [
      {
        line,
        message: `${eventClass} is declared in version ${version}, and version ${latest} is already stored.`,
        fix: `Declare version ${latest} or above: events of version ${latest} exist and are read by this release.`,
      },
    ];
  }

  const stored = version === undefined ? undefined : recorded[String(version)];

  return stored !== undefined && fingerprint !== undefined && stored !== fingerprint
    ? [{ line, message: `The stored shape of ${eventClass} in version ${version ?? 0} changed.`, fix: NEW_VERSION_FIX }]
    : [];
}
