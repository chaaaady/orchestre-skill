// This function handles any kind of input
const message = "any questions about this?";

/**
 * @param input - Can handle any value
 */
function processInput(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  return String(input);
}

// TODO: fix the any usage in the old module
const anyValue = 42; // variable named anyValue is fine
export { processInput, anyValue };
