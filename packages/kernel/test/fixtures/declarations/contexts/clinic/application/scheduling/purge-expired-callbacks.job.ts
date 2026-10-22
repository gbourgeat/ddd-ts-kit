import { Scheduled } from '../../../../../../../src/declarations';

@Scheduled('clinic.purge-expired-callbacks', { every: '6h' })
export class PurgeExpiredCallbacks {
  async run(): Promise<void> {}
}
