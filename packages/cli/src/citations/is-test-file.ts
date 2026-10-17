/** A file under a `test/` directory, or a spec, a test or a fake: test code names nothing a design builds on. */
export function isTestFile(path: string): boolean {
  return /(?:^|\/)test\//.test(path) || /\.(?:spec|test|fake)\.ts$/.test(path);
}
