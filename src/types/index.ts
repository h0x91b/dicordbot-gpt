// src/types/index.ts
import { Message } from "discord.js";

export interface ContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
  };
}

export interface ConversationMessage {
  role: string;
  content: ContentBlock[];
  function_call?: {
    name: string;
    arguments: string;
  };
  attachments?: string[];
}

export interface ProcessedMessage {
  content: ContentBlock[];
  reference?: { messageId: string | null | undefined };
  author: { bot: boolean };
}
