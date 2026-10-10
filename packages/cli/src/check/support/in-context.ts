import type { ContextLocation } from '../model/context-location.js';
import type { Location } from '../model/location.js';

export function inContext(location: Location): location is ContextLocation {
  return location.area === 'context';
}
