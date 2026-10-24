/**
 * The storage limitation of what one bounded context keeps of people (GDPR article 5(1)(e)): the
 * rows that outlived the retention their `personalFields` declaration gives are erased as it says,
 * deleted or pseudonymised, without anybody asking. Run by the platform on a schedule
 * (`privacy.purge-expired`), never by a use case. The erasure adapters of the persistence packages
 * implement it from the same declarations.
 */
export abstract class PersonalDataRetention {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.PersonalDataRetention' });
  }

  abstract readonly name: string;

  /**
   * Erases the rows whose retention ended before `now`, in the tenant of the work when it names one
   * and in every tenant when it names none (a job of the platform), and answers how many it
   * reached: none the second time.
   */
  abstract purgeExpired(now: Date): Promise<number>;
}
