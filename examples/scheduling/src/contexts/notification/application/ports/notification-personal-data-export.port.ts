import { PersonalDataExport } from '@ddd-ts-kit/kernel';

/** What notification keeps of a person, handed over when that person asks for it: the platform lists it among the exports `npm run privacy:export` gathers. */
export abstract class NotificationPersonalDataExport extends PersonalDataExport {}
