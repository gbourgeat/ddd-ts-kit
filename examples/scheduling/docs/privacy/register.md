# Register of personal data

What the system keeps of people, by context: read by `npx ddd-ts-kit docs` from the
`personalFields` declarations of each context and from the `personal` option of its integration
events, and held to the code by `docs --check`. Everything outside the markers is written by the
team and kept.

It is not the record of processing activities of GDPR article 30: that record also names the
purposes, the lawful basis, the recipients outside the system and the transfers, which no code
says. The sections after the markers are for the controller to write.

<!-- ddd-ts-kit:personal-data-register -->
## What the system knows of a person

| Context | Table | About | Personal data | On erasure | Kept |
|---|---|---|---|---|---|
| identity | `persons` | `id` | `display_name`, `email` | row deleted | until erased |
| notification | `contacts` | `recipient_id` | `address` | row deleted | until erased |
| scheduling | `agenda` | `patient_id` | `internal_note` | pseudonymised | until erased |
| scheduling | `appointments` | `patient_id` | `internal_note`, `cancellation_reason`, `document_name`, `document_media_type`, `document_checksum`, `document_size`, `document_attached_at`; files `document_key` | pseudonymised | until erased |
| scheduling | `practitioners` | `practitioner_id` | `display_name` | pseudonymised | until erased |

## Where it leaves its context

| Event | Producer | About | Personal data | Downstream |
|---|---|---|---|---|
| `identity.person.registered` (version 1) | identity | `personId` | `displayName`, `email` | notification, scheduling |
| `identity.practice.member-added` (version 1) | identity | `personId` | `displayName` | notification, scheduling |
<!-- /ddd-ts-kit:personal-data-register -->

## Purposes and lawful basis

What follows is the illustration a controller of this fictional network of practices would write;
it is not legal advice, and a real deployment has its own.

| Context | Purpose | Lawful basis |
|---|---|---|
| identity | knowing who signs in, and reaching them about their account | the contract with the person (GDPR article 6(1)(b)) |
| notification | reminding a patient of an appointment, at the address they gave | the contract with the person (article 6(1)(b)) |
| scheduling | booking and holding appointments; the notes, the cancellation reasons and the documents serve the care of the patient | the contract (article 6(1)(b)); the notes and the documents are health data, kept for the provision of care by professionals bound by secrecy (article 9(2)(h) and 9(3)) |
| analytics | counting the outcomes of the appointments of a practice | legitimate interest (article 6(1)(f)): it keeps no personal data, only counts |

## Recipients outside the system

The mailer that delivers the reminders (a processor under article 28: it receives the address and
the text of a reminder); the identity provider (Keycloak, operated by the controller); the error
tracker (Sentry, a processor: the reports carry no personal data by design, see the observability
of the platform). No transfer outside the EEA in this illustration.

## What the code does not purge

The backups of the database and of the keys until their retention ends, which bounds the day an
erasure is complete (see the README); the logs, which carry ids and codes, never a name; the files
of the storage, deleted by the erasure but kept by a versioned bucket until its retention ends; the
messages left in the outbox until it is purged and in the broker until its retention ends, which
carry the name and the address of a person (`identity.person.registered`); the audit trail, which
names a person by an opaque id only.
