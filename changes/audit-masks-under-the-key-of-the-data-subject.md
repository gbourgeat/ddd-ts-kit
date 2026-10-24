**The audit trail masks a personal value under the key of the person it belongs to, so that
erasing the person makes its masks meaningless.** `subjectMasker(keys)` of `@ddd-ts-kit/audit` is
an `AuditMasker` over the `SubjectKeyStore` of the kernel, the same keys that seal the personal
values of the stored events: each mask is an HMAC under a key derived from the key of the data
subject (HKDF, labelled for the trail), written `<keyId>:<hex>`; `SubjectKeyStore.erase` destroys
the key, and the masks made with it become tokens nobody can recompute while the entries and the
chain stay as they are. A masked field says whose its value is, `masked('patientEmail', { subject:
'patientId' })` or `subjectOf: (command) => ...`; `auditMiddleware` refuses, at wiring time, a
masked field that names none when the masker is keyed per data subject
(`MissingDataSubjectError`), and the masker refuses a subject that is not an opaque identifier
before any key is created (`MaskingSubjectNotAnIdError`): a name or an email named as the subject
would be written into the key store in clear. `hmacMasker` under one secret stays as it was.

What a masker or a declaration written by hand sees: `MaskingSubject` gains `dataSubject`, set
only for a masked field declared with `subject` or `subjectOf`; `AuditProjection` gains
`subjects`, the data subject of each masked value by field, which `auditedFields` fills and a
projection of your own may fill; `AuditedMessage` gains `subjectless`, optional, the masked fields
that name no subject, which `auditedFields` lists and a declaration of your own may leave out;
`AuditMasker` gains `requiresDataSubject`, optional, which a masker keyed per person sets so that
the middleware checks the declarations at wiring time. Nothing existing changes shape or meaning.
Part 2 of [privacy by design](../docs/proposals/privacy-by-design.md).
