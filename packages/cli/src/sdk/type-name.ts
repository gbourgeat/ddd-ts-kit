/** The prefix of the types of an operation: its function name with a capital, `OpenPractice`. */
export function typeName(functionName: string): string {
  return functionName.charAt(0).toUpperCase() + functionName.slice(1);
}
