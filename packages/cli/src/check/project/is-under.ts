export function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}
