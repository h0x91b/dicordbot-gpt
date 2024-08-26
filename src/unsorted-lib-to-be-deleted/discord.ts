// lib/discord.js
import { Message, TextChannel, Attachment } from "discord.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

import { extractCodeFromMessage } from "../utils";
import { processImage, encodeImageToBase64 } from "./image-processing";

interface ContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
  };
}

interface ConversationMessage {
  role: string;
  content: ContentBlock[];
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface ProcessedMessage {
  content: ContentBlock[];
  reference?: { messageId: string | null };
  author: { bot: boolean };
}

export async function fetchMessageHistory(
  msg: Message
): Promise<ConversationMessage[]> {
  let refMsg = msg.reference?.messageId;
  const gptConversation: ConversationMessage[] = [];

  async function processMessage(message: Message): Promise<ProcessedMessage> {
    let content: ContentBlock[] = [];
    if (typeof message.content === "string" && message.content.length > 0) {
      content.push({ type: "text", text: message.content });
    }

    if (message.attachments.size > 0) {
      for (const [id, attachment] of message.attachments) {
        if (
          attachment.contentType &&
          attachment.contentType.startsWith("image/")
        ) {
          try {
            const response = await fetch(attachment.url);
            const buffer = await response.arrayBuffer();
            const processedBuffer = await processImage(Buffer.from(buffer));
            const base64Image = encodeImageToBase64(processedBuffer);

            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: attachment.contentType,
                data: base64Image,
              },
            });
          } catch (error) {
            console.error(`Error processing image ${attachment.name}:`, error);
          }
        } else if (
          attachment.contentType &&
          (attachment.contentType.startsWith("text/") ||
            attachment.contentType.includes("javascript"))
        ) {
          try {
            const textContent = await fetchAttachmentContent(attachment);
            content.push({
              type: "text",
              text: `Attachment ${attachment.name}:\n${textContent}`,
            });
          } catch (error) {
            console.error(
              `Error processing attachment ${attachment.name}:`,
              error
            );
          }
        }
      }
    }
    return {
      content,
      reference: message.reference
        ? { messageId: message.reference.messageId ?? null }
        : undefined,
      author: { bot: message.author.bot },
    };
  }

  let currentRole: string | null = null;
  let accumulatedContent: ContentBlock[] = [];

  function addMessageToConversation(role: string, content: ContentBlock[]) {
    if (content.length > 0) {
      if (gptConversation.length > 0 && gptConversation[0].role === role) {
        // If the last message has the same role, combine the contents
        gptConversation[0].content = [
          ...content,
          ...gptConversation[0].content,
        ];
      } else {
        gptConversation.unshift({ role, content });
      }
    }
  }

  for (let i = 0; i < 30; i++) {
    if (!refMsg) break;
    console.log("fetching message", refMsg);
    let refMsgObj = await loadReferenceMessage(msg, refMsg);
    if (!refMsgObj) break;
    const processedMsg = await processMessage(refMsgObj);
    refMsg = processedMsg.reference?.messageId ?? undefined;

    const regex = /^\[([^\n]*)\]/;
    let cleanedContent = processedMsg.content.map((item: ContentBlock) => {
      if (item.type === "text" && item.text) {
        return { ...item, text: item.text.replace(regex, "").trim() };
      }
      return item;
    });

    if (processedMsg.author.bot) {
      if (
        cleanedContent[0]?.type === "text" &&
        cleanedContent[0].text?.startsWith("[function_call]")
      ) {
        addMessageToConversation(currentRole || "user", accumulatedContent);
        currentRole = null;
        accumulatedContent = [];
        const extractedCode = await extractCodeFromMessage(
          cleanedContent[0].text
        );
        if (extractedCode && extractedCode.length > 0) {
          const fn = JSON.parse(extractedCode[0]);
          gptConversation.unshift({
            role: "assistant",
            content: [],
            function_call: {
              name: fn.name,
              arguments: JSON.stringify(fn.function_call.arguments),
            },
          });
        }
      } else if (
        cleanedContent[0]?.type === "text" &&
        cleanedContent[0].text?.startsWith("[function_call_response]")
      ) {
        addMessageToConversation(currentRole || "user", accumulatedContent);
        currentRole = null;
        accumulatedContent = [];
        const fn = cleanedContent[0].text.split(" ")[1];
        const [file] = await downloadAttachmentsFromMessage(refMsgObj);
        gptConversation.unshift({
          role: "function",
          content: [{ type: "text", text: file }],
        });
      } else {
        if (
          processedMsg.content.some(
            (item: ContentBlock) => item.type === "image"
          )
        ) {
          currentRole = "user";
          accumulatedContent = [...cleanedContent, ...accumulatedContent];
        } else if (currentRole !== "assistant") {
          addMessageToConversation(currentRole || "user", accumulatedContent);
          currentRole = "assistant";
          accumulatedContent = cleanedContent;
        } else {
          accumulatedContent = [...cleanedContent, ...accumulatedContent];
        }
      }
    } else {
      if (currentRole !== "user") {
        addMessageToConversation(
          currentRole || "assistant",
          accumulatedContent
        );
        currentRole = "user";
        accumulatedContent = cleanedContent;
      } else {
        accumulatedContent = [...cleanedContent, ...accumulatedContent];
      }
    }
  }

  // Add any remaining accumulated content
  addMessageToConversation(currentRole || "user", accumulatedContent);

  const processedMsg = await processMessage(msg);

  const lastMessage = gptConversation[gptConversation.length - 1];
  if (lastMessage && lastMessage.role === "user") {
    lastMessage.content.push(...processedMsg.content);
  } else {
    gptConversation.push({
      role: "user",
      content: processedMsg.content,
    });
  }

  return gptConversation;
}

export async function loadReferenceMessage(
  msg: Message,
  messageId: string
): Promise<Message | null> {
  if (msg.channel instanceof TextChannel) {
    try {
      const refMsgObj = await msg.channel.messages.fetch(messageId);
      return refMsgObj;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }
  return null;
}

async function downloadAttachment(
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

export async function downloadAttachmentsFromMessage(
  message: Message
): Promise<string[]> {
  let attachmentsArray: string[] = [];
  for (let attachment of message.attachments.values()) {
    let filename = attachment.name ?? "unnamed_attachment";
    let url = attachment.url;
    const fileContent = await downloadAttachment(url, filename);
    attachmentsArray.push(fileContent);
  }
  return attachmentsArray;
}

async function fetchAttachmentContent(attachment: Attachment): Promise<string> {
  const response = await fetch(attachment.url);
  if (!response.ok)
    throw new Error(`Не удалось скачать аттачмент: ${response.statusText}`);
  return await response.text();
}
