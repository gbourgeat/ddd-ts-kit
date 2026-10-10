import type { Location } from '../model/location.js';

export function isTestFile(file: string, location: Location): boolean {
  return /\.(?:spec|test)\.ts$/.test(file) || (location.area === 'context' && location.layer === 'test');
}
