/**
 * How the rows about a data subject are erased: `row`, they are deleted; `pseudonymise`, they
 * stay and each personal field reads `ERASED_PERSONAL_DATA` (a text) or nothing (any other type),
 * so that what referenced the rows still resolves and the history stays readable without the person.
 */
export type ErasureMode = 'row' | 'pseudonymise';
