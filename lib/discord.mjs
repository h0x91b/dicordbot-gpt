// lib/discord.mjs
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

import { extractCodeFromMessage } from "./utils.mjs";

export async function fetchMessageHistory(msg) {
  let refMsg = msg.reference?.messageId;
  const gptConversation = [];

  async function processMessage(message) {
    if (message.attachments.size > 0) {
      let attachmentContent = "";
      for (const [id, attachment] of message.attachments) {
        if (
          attachment.contentType &&
          (attachment.contentType.startsWith("text/") ||
            attachment.contentType.includes("javascript"))
        ) {
          try {
            const content = await fetchAttachmentContent(attachment);
            attachmentContent += `\n\nАттачмент ${attachment.name}:\n${content}`;
          } catch (error) {
            console.error(
              `Ошибка при обработке аттачмента ${attachment.name}:`,
              error
            );
          }
        }
      }
      if (attachmentContent) {
        message.content += attachmentContent;
      }
    }
    return message;
  }

  let currentRole = null;
  let accumulatedContent = "";

  function addMessageToConversation(role, content) {
    if (content.trim()) {
      if (gptConversation.length > 0 && gptConversation[0].role === role) {
        // If the last message has the same role, combine the contents
        gptConversation[0].content =
          content.trim() + "\n\n" + gptConversation[0].content;
      } else {
        gptConversation.unshift({ role, content: content.trim() });
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
    let cleanedMessage = refMsgObj.content.replace(regex, "").trim();

    if (refMsgObj.author.bot) {
      if (refMsgObj.content.startsWith("[function_call]")) {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = null;
        accumulatedContent = "";
        let [fn] = await extractCodeFromMessage(refMsgObj.content);
        fn = JSON.parse(fn);
        gptConversation.unshift({
          role: "assistant",
          content: null,
          function_call: {
            name: fn.name,
            arguments: JSON.stringify(fn.function_call.arguments),
          },
        });
      } else if (refMsgObj.content.startsWith("[function_call_response]")) {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = null;
        accumulatedContent = "";
        const fn = refMsgObj.content.split(" ")[1];
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
          accumulatedContent = cleanedMessage;
        } else {
          accumulatedContent = cleanedMessage + "\n\n" + accumulatedContent;
        }
      }
    } else {
      if (currentRole !== "user") {
        addMessageToConversation(currentRole, accumulatedContent);
        currentRole = "user";
        accumulatedContent = cleanedMessage;
      } else {
        accumulatedContent = cleanedMessage + "\n\n" + accumulatedContent;
      }
    }
  }

  // Add any remaining accumulated content
  addMessageToConversation(currentRole, accumulatedContent);

  const content = msg.content.replace("!gpt", "").replace("!гпт", "");
  const processedMsg = await processMessage(msg);

  // Add the current message to the conversation
  if (gptConversation.length > 0 && gptConversation[0].role === "user") {
    gptConversation[0].content += "\n\n" + processedMsg.content;
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
