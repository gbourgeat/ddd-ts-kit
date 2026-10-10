import type { Location } from './location.js';

export function isTestFile(file: string, location: Location): boolean {
  return /\.(?:spec|test)\.ts$/.test(file) || (location.area === 'context' && location.layer === 'test');
}
