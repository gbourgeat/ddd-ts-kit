**The audit trail masks a personal value under the key of the person it belongs to, so that
erasing the person makes its masks meaningless.** `subjectMasker(keys)` of `@ddd-ts-kit/audit` is
an `AuditMasker` over the `SubjectKeyStore` of the kernel, the same keys that seal the personal
values of the stored events: each mask is an HMAC under a key derived from the key of the data
subject (HKDF, labelled for the trail), written `<keyId>:<hex>`; `SubjectKeyStore.erase` destroys
the key, and the masks made with it become tokens nobody can recompute while the entries and the
chain stay as they are. A masked field says whose its value is, `masked('patientEmail', { subject:
'patientId' })` or `subjectOf: (command) => ...`, which every masker reads as `dataSubject` of its
`MaskingSubject`; `auditMiddleware` refuses, at wiring time, a masked field that names none when
the masker is keyed per data subject (`MissingDataSubjectError`). `hmacMasker` under one secret
stays as it was. Part 2 of [privacy by design](../docs/proposals/privacy-by-design.md).
