import { promises as fs } from "fs";

export async function tempFile(content: string): Promise<string> {
  const fileName = `/tmp/output.${Math.floor(Math.random() * 1000000)}.json`;
  await fs.writeFile(fileName, content);
  setTimeout(() => {
    console.log("delete temp file", fileName);
    fs.unlink(fileName);
  }, 5000);
  return fileName;
}

export async function extractCodeFromMessage(
  message: string
): Promise<string[] | null> {
  const regexCode = /```(?:([a-zA-Z0-9\+]+)\n)?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let matches: string[] = [];

  while ((match = regexCode.exec(message)) !== null) {
    matches.push(match[2]); // match[2] contains the matched code, match[1] would contain the language if it exists
  }

  return matches.length ? matches : null;
}
