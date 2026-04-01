/**
 * Parses hook input from environment variable or stdin.
 * Claude Code passes TOOL_INPUT as an env var containing JSON.
 */
export async function parseHookInput() {
  // Try environment variable first
  const envInput = process.env.TOOL_INPUT;
  if (envInput) {
    return parseToolInput(envInput);
  }

  // Fall back to stdin
  const stdin = await readStdin();
  if (stdin) {
    return parseToolInput(stdin);
  }

  throw new Error('No input available');
}

function parseToolInput(raw) {
  try {
    const data = JSON.parse(raw);
    // Handle both Write and Edit tool formats
    const filePath = data.file_path || data.filePath || '';
    const content = data.content || data.new_string || '';
    return { filePath, content, raw: data };
  } catch {
    throw new Error('Failed to parse TOOL_INPUT JSON');
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // Timeout after 1s to not hang
    setTimeout(() => resolve(data), 1000);
  });
}
