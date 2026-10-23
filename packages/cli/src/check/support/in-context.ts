import type { ContextLocation } from '../model/context-location';
import type { Location } from '../model/location';

export function inContext(location: Location): location is ContextLocation {
  return location.area === 'context';
}
