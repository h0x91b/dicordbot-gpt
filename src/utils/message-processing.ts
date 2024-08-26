// src/utils/message-processing.ts
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { Attachment, Message } from "discord.js";
import fetch from "node-fetch";
import { ProcessedMessage, ContentBlock } from "../types";

export async function processMessage(
  message: Message
): Promise<ProcessedMessage> {
  const processedMessage: ProcessedMessage = {
    content: [{ type: "text", text: message.content }],
    author: { bot: message.author.bot },
    reference: message.reference
      ? { messageId: message.reference.messageId ?? null }
      : undefined,
  };

  if (message.attachments.size > 0) {
    for (const [, attachment] of message.attachments) {
      try {
        const content = await fetchAttachmentContent(attachment);
        processedMessage.content.push({
          type: "attachment",
          source: {
            type: "text",
            data: content,
          },
        });
      } catch (error) {
        console.error(`Error processing attachment: ${error}`);
      }
    }
  }

  return processedMessage;
}

export async function fetchAttachmentContent(
  attachment: Attachment
): Promise<string> {
  const response = await fetch(attachment.url);
  if (!response.ok)
    throw new Error(`Не удалось скачать аттачмент: ${response.statusText}`);
  return await response.text();
}

export async function downloadAttachment(
  url: string,
  filename: string
): Promise<string> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const filePath = path.join("/tmp", filename);
  await fs.writeFile(filePath, response.data);

  // Read the file content
  const fileContent = await fs.readFile(filePath);

  // delete the file immediately after reading
  try {
    await fs.unlink(filePath);
    console.log(`Deleted file: ${filePath}`);
  } catch (err) {
    console.error(`Error deleting file: ${filePath}`, err);
  }

  // return file content
  return fileContent.toString("utf8");
}
