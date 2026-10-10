/**
 * Which allowed decisions about reads are recorded, next to those of sensitive permissions:
 * none (`sensitive`), every one (`all`), or a share of them between 0 and 1.
 */
export type AllowedReads = 'sensitive' | 'all' | { readonly sample: number; readonly random?: () => number };
