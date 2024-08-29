// src/handlers/grammarHandlers.ts

import { Message } from "discord.js";
import {
  buildGrammarFixPrompt,
  buildGrammarFix2Prompt,
} from "../prompts/grammar";

export interface GrammarFixOptions {
  skipCost: boolean;
  skipCounter: boolean;
  skipReactions: boolean;
}

interface UserMessage {
  createdTimestamp: number;
  content: string;
}

let grammarTimers: { [key: string]: NodeJS.Timeout } = {};
let lastUserMessageId: { [key: string]: number } = {};

export async function handleGrammarFix(
  msg: Message,
  getUserLastMessage: (
    msg: Message,
    count: number,
    maxTime: number
  ) => Promise<UserMessage[]>,
  gpt: Function
): Promise<void> {
  console.log("handleGrammarFix", msg.author.username, msg.content);
  if (grammarTimers[msg.author.id]) {
    clearTimeout(grammarTimers[msg.author.id]);
  }
  grammarTimers[msg.author.id] = setTimeout(async () => {
    delete grammarTimers[msg.author.id];
    const prompt = buildGrammarFixPrompt();
    const lastId = lastUserMessageId[msg.author.id] || 0;
    const lastMessages = (
      await getUserLastMessage(msg, 10, 1000 * 60 * 5)
    ).filter(({ createdTimestamp }) => createdTimestamp > lastId);
    if (!lastMessages.length) return;
    const response = await gpt(
      msg,
      [
        {
          role: "user",
          content: `User: ${JSON.stringify(
            lastMessages.map(({ content }) => content).join("\n")
          )}`,
        },
      ],
      {
        overrideSystemMessage: prompt,
        skipCost: true,
        skipCounter: true,
        skipReactions: true,
      }
    );
    console.log("fix grammar response: ", response);
    try {
      const obj = JSON.parse(response);
      lastUserMessageId[msg.author.id] = msg.createdTimestamp;
      if (!obj.errorCount) return;
      await msg.reply(`Fixed ${obj.errorCount} grammar errors:
\`\`\`
${obj.fixed}
\`\`\`
`);
    } catch (e) {}
  }, 15000);
}

export async function handleGrammarFix2(
  msg: Message,
  getUserLastMessage: (
    msg: Message,
    count: number,
    maxTime: number
  ) => Promise<UserMessage[]>,
  gpt: Function
): Promise<void> {
  console.log("handleGrammarFix2", msg.author.username, msg.content);
  if (grammarTimers[msg.author.id]) {
    clearTimeout(grammarTimers[msg.author.id]);
  }
  grammarTimers[msg.author.id] = setTimeout(async () => {
    delete grammarTimers[msg.author.id];
    const prompt = buildGrammarFix2Prompt();
    const lastId = lastUserMessageId[msg.author.id] || 0;
    const lastMessages = (
      await getUserLastMessage(msg, 10, 1000 * 60 * 5)
    ).filter(({ createdTimestamp }) => createdTimestamp > lastId);
    if (!lastMessages.length) return;
    if (lastMessages.map(({ content }) => content).join("").length < 5) return;
    const response = await gpt(
      msg,
      [
        {
          role: "user",
          content: `${JSON.stringify(
            lastMessages.map(({ content }) => content).join("\n")
          )}`,
        },
      ],
      {
        overrideSystemMessage: prompt,
        skipCost: true,
        skipCounter: true,
        skipReactions: true,
      }
    );
    console.log("fix grammar response: ", response);
    lastUserMessageId[msg.author.id] = msg.createdTimestamp;
    await msg.channel.send(`Fixed grammar errors for user "${
      msg.author.username
    }":
${response.replace(/\n/g, "\n")}
`);
  }, 45000);
}
