import { PersonalDataErasure } from '@ddd-ts-kit/kernel';

/** What identity keeps of a person, erased when that person asks: the platform lists it among the copies `npm run privacy:erase` reaches. */
export abstract class IdentityPersonalDataErasure extends PersonalDataErasure {}
