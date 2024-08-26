// src/services/messageServices.ts
import { Message, TextChannel, Client } from "discord.js";
import { promises as fsP, unlinkSync } from "fs";
import axios from "axios";

import { fetchMessageHistory } from "./discord";
import { buildSystemMessage } from "../prompts/systemMessage";
import { aiCodeAssistChannels, authorsToAllowGPT4 } from "../config";

export function isBotMentioned(msg: Message): boolean {
  const includesArray = ["ботик", "ботяра", "ботан", "botik", "botan"];
  return (
    msg?.mentions?.repliedUser?.id === "1085479521240743946" ||
    includesArray.some((include) => msg.content.toLowerCase().includes(include))
  );
}

export async function handleHello(msg: Message) {
  msg.reply("Hello, I am your bot!");
}

export async function handleGpt(client: Client, msg: Message) {
  msg.react("👀");
  const options: GptOptions = {};
  if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name))
    options.putSystemMessageFirst = true;
  const response = await gpt(
    client,
    msg,
    [
      {
        role: "user",
        content: msg.content.replace("!gpt", "").replace("!гпт", ""),
      },
    ],
    options
  );
  // return generateVoiceResponse(msg, response);
  sendSplitResponse(msg, response);
}

export async function handleMessageWithEmiliaMention(
  client: Client,
  msg: Message
) {
  msg.react("👀");
  const gptConversation = await fetchMessageHistory(msg);
  const options: GptOptions = {};
  if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name))
    options.putSystemMessageFirst = true;
  const response = await gpt(client, msg, gptConversation, options);
  return sendSplitResponse(msg, response);
  // return generateVoiceResponse(msg, response);
}

export async function sendSplitResponse(msg: Message, text: string) {
  let codeFile: string | undefined;
  const regexCode = /```(?:([a-zA-Z0-9\+]+)\n)?([\s\S]*?)```/g;

  let match = regexCode.exec(text);
  let response = text.replace(regexCode, "");

  if (match) {
    const language = match[1] || "txt";
    const code = match[2];

    console.log("Language:", language);
    console.log("Code:", code);

    codeFile = `output.${Math.floor(Math.random() * 1000000)}.${language}`;
    await fsP.writeFile(codeFile, code);
    setTimeout(() => {
      unlinkSync(codeFile!);
    }, 60000);
  }
  let files: string[] = [];
  if (codeFile) files.push(codeFile);
  if (response?.length > 1800) {
    const parts = response.match(/[\s\S]{1,1800}/g) || [];
    for (let i = 0; i < parts.length; i++) {
      msg.reply({ content: parts[i] });
    }
    return;
  }
  msg.reply({ content: response, files });
}

export function getGPTModelName(msg: Message): string {
  if (!msg || !msg.author.username) return "gpt-3.5-turbo-16k";
  if (
    (msg?.content?.includes("gpt-4") || msg?.content?.includes("gpt4")) &&
    authorsToAllowGPT4.includes(msg.author.id)
  ) {
    return "gpt-4o";
  }
  return "gpt-4o";
  // return "gpt-3.5-turbo-16k";
}

interface GptOptions {
  overrideSystemMessage?: string | null;
  skipCost?: boolean;
  skipReactions?: boolean;
  putSystemMessageFirst?: boolean;
  skipCounter?: boolean;
}

export async function gpt(
  client: Client,
  msg: Message,
  conversation: any[],
  options: GptOptions = {}
) {
  const now = Date.now();
  const systemMessage =
    options?.overrideSystemMessage || buildSystemMessage(msg);
  const messages = [];
  if (conversation.length < 1 || options?.putSystemMessageFirst) {
    messages.push({
      role: "system",
      content: systemMessage,
    });
  }
  for (let i = 0; i < conversation.length; i++) {
    if (1 === conversation.length - i && !options?.putSystemMessageFirst) {
      messages.push({
        role: "system",
        content: systemMessage,
      });
    }
    messages.push(conversation[i]);
  }
  console.log("gpt", messages);
  const model = getGPTModelName(msg);
  const requestBody = {
    model,
    messages,
    user: `<@${msg.author.id}>`,
    max_tokens: 600,
  };

  let timeout: NodeJS.Timeout | null = null;
  const maxResponseTime = 120000;
  try {
    const reactions = [
      "0️⃣",
      "🪆",
      "1️⃣",
      "♠",
      "2️⃣",
      "♥",
      "3️⃣",
      "♦",
      "4️⃣",
      "♣",
      "5️⃣",
      "🩴",
      "6️⃣",
      "🩲",
      "7️⃣",
      "🩳",
      "8️⃣",
      "🩰",
      "9️⃣",
      "👠",
      "🔟",
      "🎓",
      "💣",
    ];

    let currentIndex = 0;

    async function fn() {
      if (currentIndex > 0) {
        const previousReaction = msg.reactions.resolve(
          reactions[currentIndex - 1]
        );
        if (previousReaction && client.user) {
          previousReaction.users.remove(client.user.id);
        }
      }

      if (currentIndex < reactions.length) {
        msg.react(reactions[currentIndex]);
        currentIndex++;
        timeout = setTimeout(fn, maxResponseTime / 10);
      }
    }

    if (!options.skipReactions)
      timeout = setTimeout(fn, maxResponseTime / reactions.length);
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: maxResponseTime,
      }
    );
    if (timeout) clearTimeout(timeout);
    const { choices, ...meta } = response.data;
    console.log("gpt response", choices, meta);
    const responseTime = ((Date.now() - now) / 1000).toFixed(2);
    console.log("responseTime", responseTime);
    if (options.skipCost) return choices[0].message.content;
    let price: number;
    // Model	Input	Output
    // 4K context	$0.0015 / 1K tokens	$0.002 / 1K tokens
    // 16K context	$0.003 / 1K tokens	$0.004 / 1K tokens

    switch (model) {
      case "gpt-3.5-turbo":
      case "gpt-3.5-turbo-16k":
        price =
          (meta.usage.prompt_tokens / 1000000) * 1.5 +
          (meta.usage.completion_tokens / 1000000) * 2.0;
        break;
      case "gpt-4":
        price =
          (meta.usage.prompt_tokens / 1000000) * 30.0 +
          (meta.usage.completion_tokens / 1000000) * 60.0;
        break;
      case "gpt-4-turbo":
        price =
          (meta.usage.prompt_tokens / 1000000) * 10.0 +
          (meta.usage.completion_tokens / 1000000) * 30.0;
        break;
      case "gpt-4o":
        price =
          (meta.usage.prompt_tokens / 1000000) * 5.0 +
          (meta.usage.completion_tokens / 1000000) * 15.0;
        break;
      default:
        price = 999.99;
        break;
    }

    return (
      `[${model} cost: ${price.toFixed(4)}$ tokens: ${
        meta.usage.prompt_tokens + meta.usage.completion_tokens
      }]
` + choices[0].message.content
    );
  } catch (error: any) {
    console.error(
      "Error calling ChatGPT API:",
      error?.response?.status,
      error?.response?.statusText,
      error?.response?.data?.error,
      error?.response?.headers
    );
    clearTimeout(timeout!);
    return `Error calling ChatGPT API: ${error?.response?.status} ${
      error?.response?.statusText
    } \`\`\`${JSON.stringify(error?.response?.data?.error, null, 2)}\`\`\``;
  }
}
