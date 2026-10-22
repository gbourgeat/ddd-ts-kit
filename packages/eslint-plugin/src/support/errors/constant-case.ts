import { splitWords } from '../words/split-words';

/** `slotTaken` and `SlotTaken` both read `SLOT_TAKEN`. */
export function constantCase(name: string): string {
  return splitWords(name).join('_').toUpperCase();
}
