// src/services/discord.ts
import { Message, TextChannel, Attachment } from "discord.js";
import { processImage, encodeImageToBase64 } from "../utils";
import { ConversationMessage, ContentBlock } from "../types/";
import { fetchAttachmentContent } from "../utils/message-processing";

export async function fetchMessageHistory(
  msg: Message
): Promise<ConversationMessage[]> {
  let refMsg = msg.reference?.messageId;
  const gptConversation: ConversationMessage[] = [];
  let currentRole: string | null = null;
  let accumulatedContent: ContentBlock[] = [];

  async function processMessage(
    message: Message
  ): Promise<ConversationMessage> {
    let content: ContentBlock[] = [];
    if (typeof message.content === "string" && message.content.length > 0) {
      content.push({ type: "text", text: message.content });
    }

    if (message.attachments.size > 0) {
      for (const [, attachment] of message.attachments) {
        if (attachment.contentType?.startsWith("image/")) {
          try {
            const imageContent = await processImageAttachment(attachment);
            content.push(imageContent);
          } catch (error) {
            console.error(`Error processing image ${attachment.name}:`, error);
          }
        } else if (
          attachment.contentType?.startsWith("text/") ||
          attachment.contentType?.startsWith("application/json") ||
          attachment.contentType?.includes("javascript")
        ) {
          try {
            const textContent = await processTextAttachment(attachment);
            content.push(textContent);
          } catch (error) {
            console.error(
              `Error processing attachment ${attachment.name}:`,
              error
            );
          }
        } else {
          console.log(
            `Attachment ${attachment.name} has unsupported content type: ${attachment.contentType}`
          );
        }
      }
    }
    return {
      role: message.author.bot ? "assistant" : "user",
      content,
    };
  }

  function addMessageToConversation(role: string, content: ContentBlock[]) {
    if (content.length > 0) {
      if (gptConversation.length > 0 && gptConversation[0].role === role) {
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
    refMsg = refMsgObj.reference?.messageId;

    const regex = /^\[([^\n]*)\]/;
    let cleanedContent = processedMsg.content.map((item) => {
      if (item.type === "text") {
        return { ...item, text: item.text?.replace(regex, "").trim() };
      }
      return item;
    });

    if (refMsgObj.author.bot) {
      if (processedMsg.content.some((item) => item.type === "image")) {
        currentRole = "user";
        accumulatedContent = [...cleanedContent, ...accumulatedContent];
      } else if (currentRole !== "assistant") {
        addMessageToConversation(currentRole!, accumulatedContent);
        currentRole = "assistant";
        accumulatedContent = cleanedContent;
      } else {
        accumulatedContent = [...cleanedContent, ...accumulatedContent];
      }
    } else {
      if (currentRole !== "user") {
        addMessageToConversation(currentRole!, accumulatedContent);
        currentRole = "user";
        accumulatedContent = cleanedContent;
      } else {
        accumulatedContent = [...cleanedContent, ...accumulatedContent];
      }
    }
  }

  // Add any remaining accumulated content
  addMessageToConversation(currentRole!, accumulatedContent);

  const processedMsg = await processMessage(msg);

  const lastMessage = gptConversation[gptConversation.length - 1];
  if (lastMessage && lastMessage.role === "user") {
    lastMessage.content.push(...processedMsg.content);
  } else {
    gptConversation.push(processedMsg);
  }

  return gptConversation;
}

async function processImageAttachment(
  attachment: Attachment
): Promise<ContentBlock> {
  const response = await fetch(attachment.url);
  const buffer = await response.arrayBuffer();
  const processedImage = await processImage(Buffer.from(buffer));
  const base64Image = encodeImageToBase64(processedImage);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: attachment.contentType || "image/png",
      data: base64Image,
    },
  };
}

async function processTextAttachment(
  attachment: Attachment
): Promise<ContentBlock> {
  const attachmentContent = await fetchAttachmentContent(attachment);
  return {
    type: "text",
    text: `Attachment ${attachment.name}:\n${attachmentContent}`,
  };
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

export async function downloadAttachmentsFromMessage(
  message: Message
): Promise<string[]> {
  const attachmentsArray: string[] = [];
  for (const attachment of message.attachments.values()) {
    try {
      const content = await fetchAttachmentContent(attachment);
      attachmentsArray.push(content);
    } catch (error) {
      console.error(`Error downloading attachment: ${error}`);
    }
  }
  return attachmentsArray;
}
