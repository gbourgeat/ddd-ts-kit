# Register of personal data

What the system keeps of people, by context: read by `npx ddd-ts-kit docs` from the
`personalFields` declarations of each context and from the `personal` option of its integration
events, and held to the code by `docs --check`. Everything outside the markers is written by the
team and kept.

It is not the record of processing activities of GDPR article 30: that record also names the
purposes, the lawful basis, the recipients outside the system and the transfers, which no code
says. The sections after the markers are for the controller to write.

<!-- ddd-ts-kit:personal-data-register -->
<!-- /ddd-ts-kit:personal-data-register -->

## Purposes and lawful basis

TODO(domain): for each context above, why it keeps these data and on which lawful basis (GDPR article 6).

## Recipients outside the system

TODO(domain): the processors and the third parties that receive personal data (mail, payment, analytics), and the transfers outside the EEA with their safeguards.

## What the code does not purge

TODO(domain): how long the backups, the logs, the files and the archives of the audit trail keep personal data, and who deletes them.
