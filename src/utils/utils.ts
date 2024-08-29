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
