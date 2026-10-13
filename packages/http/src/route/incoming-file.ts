import type { ReceivedFile } from '@ddd-ts-kit/kernel';

/**
 * The file of an upload as a handler receives it: still streaming, checked on its way, the
 * `ReceivedFile` of the kernel that a controller hands to its command as it is.
 */
export type IncomingFile = ReceivedFile;
