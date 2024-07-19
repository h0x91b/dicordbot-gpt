// lib/discord.mjs
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

import { extractCodeFromMessage } from "./utils.mjs";
import { processImage, encodeImageToBase64 } from "./image-processing.mjs";

export async function fetchMessageHistory(msg) {
  let refMsg = msg.reference?.messageId;
  const gptConversation = [];

  async function processMessage(message) {
    let content = [];
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
    return { ...message, content };
  }

  let currentRole = null;
  let accumulatedContent = [];

  function addMessageToConversation(role, content) {
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
    refMsgObj = await processMessage(refMsgObj);
    refMsg = refMsgObj?.reference?.messageId;

    const regex = /^\[([^\n]*)\]/;
    let cleanedContent = refMsgObj.content.map((item) => {
      if (item.type === "text") {
        return { ...item, text: item.text.replace(regex, "").trim() };
      }
      return item;
    });

    if (refMsgObj.author.bot) {
      if (cleanedContent[0]?.text?.startsWith("[function_call]")) {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = null;
        accumulatedContent = [];
        let [fn] = await extractCodeFromMessage(cleanedContent[0].text);
        fn = JSON.parse(fn);
        gptConversation.unshift({
          role: "assistant",
          content: null,
          function_call: {
            name: fn.name,
            arguments: JSON.stringify(fn.function_call.arguments),
          },
        });
      } else if (
        cleanedContent[0]?.text?.startsWith("[function_call_response]")
      ) {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = null;
        accumulatedContent = [];
        const fn = cleanedContent[0].text.split(" ")[1];
        const [file] = await downloadAttachmentsFromMessage(refMsgObj);
        gptConversation.unshift({
          role: "function",
          name: fn,
          content: file,
        });
      } else {
        if (currentRole !== "assistant") {
          addMessageToConversation(currentRole, accumulatedContent);
          currentRole = "assistant";
          accumulatedContent = cleanedContent;
        } else {
          accumulatedContent = [...cleanedContent, ...accumulatedContent];
        }
      }
    } else {
      if (currentRole !== "user") {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = "user";
        accumulatedContent = cleanedContent;
      } else {
        accumulatedContent = [...cleanedContent, ...accumulatedContent];
      }
    }
  }

  // Add any remaining accumulated content
  addMessageToConversation(currentRole, accumulatedContent);

  const content = msg.content.replace("!gpt", "").replace("!гпт", "");
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

export async function loadReferenceMessage(msg, messageId) {
  const refMsgObj = await msg?.channel?.messages.fetch(messageId);
  return refMsgObj;
}

async function downloadAttachment(url, filename) {
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

export async function downloadAttachmentsFromMessage(message) {
  let attachmentsArray = [];
  for (let attachment of message.attachments.values()) {
    let filename = attachment.name;
    let url = attachment.url;
    const fileContent = await downloadAttachment(url, filename);
    attachmentsArray.push(fileContent);
  }
  return attachmentsArray;
}

async function fetchAttachmentContent(attachment) {
  const response = await fetch(attachment.url);
  if (!response.ok)
    throw new Error(`Не удалось скачать аттачмент: ${response.statusText}`);
  return await response.text();
}
