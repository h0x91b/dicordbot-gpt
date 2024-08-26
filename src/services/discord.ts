// src/services/discord.ts
import { Message, TextChannel, Attachment } from "discord.js";
import fetch from "node-fetch";
import { processImage, encodeImageToBase64 } from "../utils/image-processing";
import { ProcessedMessage, ConversationMessage, ContentBlock } from "../types/";
import {
  fetchAttachmentContent,
  downloadAttachment,
} from "../utils/message-processing";

export async function fetchMessageHistory(
  msg: Message
): Promise<ConversationMessage[]> {
  let refMsg = msg.reference?.messageId;
  const gptConversation: ConversationMessage[] = [];

  while (refMsg) {
    const refMsgObj = await loadReferenceMessage(msg, refMsg);
    if (!refMsgObj) break;

    const attachments = await downloadAttachmentsFromMessage(refMsgObj);
    const processedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const processedImage = await processImage(Buffer.from(attachment, 'utf-8'));
        return encodeImageToBase64(processedImage);
      })
    );

    gptConversation.unshift({
      role: refMsgObj.author.bot ? "assistant" : "user",
      content: [{ type: "text", text: refMsgObj.content }],
      attachments: processedAttachments,
    });

    refMsg = refMsgObj.reference?.messageId;
  }

  const attachments = await downloadAttachmentsFromMessage(msg);
  const processedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      const processedImage = await processImage(Buffer.from(attachment, 'utf-8'));
      return encodeImageToBase64(processedImage);
    })
  );

  gptConversation.push({
    role: "user",
    content: [{ type: "text", text: msg.content }],
    attachments: processedAttachments,
  });

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