import { PersonalDataErasure } from '@ddd-ts-kit/kernel';

/**
 * What scheduling keeps of a person in clear, erased when that person asks: the notes the staff
 * wrote on their appointments, the reasons of their cancellations, the documents attached to those
 * appointments, and the name copied into the practitioner directory. The platform lists it among
 * the copies `npm run privacy:erase` reaches, in each network, after the key is destroyed.
 */
export abstract class SchedulingPersonalDataErasure extends PersonalDataErasure {}
