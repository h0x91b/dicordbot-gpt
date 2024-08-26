import dotenv from "dotenv";
dotenv.config();
import { promises as fsP, unlinkSync } from "fs";
import axios from "axios";
import { encode, decode } from "gpt-3-encoder";
import { Events, TextChannel, Role, Message } from "discord.js";

import { coderChatbotHandler } from "./commands/coder";
import { loadReferenceMessage } from "./services/discord";
import { initializeBot } from "./bot";
import { handleGrammarFix2 } from "./handlers/grammarHandlers";
import {
  buildSystemMessage,
  currentTestPrompt,
  setCurrentTestPrompt,
} from "./prompts/systemMessage";
import { handleImageGeneration } from "./services/imageGeneration";

let availableDiscordChannels: string[] = [];

const client = initializeBot();

const authorsToAllowGPT4 = [
  "405507382207315978", //h0x91b
  "431153536768933888", //xxsemaxx
];
const authorsToAllowDocIndex = [
  "405507382207315978", //h0x91b
];
const fixGrammarUsers: string[] = [
  // "309119244979798016", // Wlastas
  // "405507382207315978", // h0x91b
];

const aiCodeAssistChannels = [
  "ai-cpp-code-assistant",
  "ai-zig-code-assistant",
  "ai-js-code-assistant",
  "ai-python-code-assistant",
  "ai-csharp-code-assistant",
  "ai-any-language",
  "ai-rude",
];

client.on("ready", async () => {
  if (client.user) {
    console.log(`Logged in as ${client.user.tag}!`);
  }

  console.log("guilds", client.guilds);
  // get all available channels
  client.guilds.cache.forEach((guild) => {
    console.log(`Guild: ${guild.name}`);
    guild.channels.cache.forEach((channel) => {
      if (channel.type === 0) {
        availableDiscordChannels.push(`#${channel.name} - <#${channel.id}>`);
      }
    });
  });
  console.log("availableDiscordChannels", availableDiscordChannels.join("\n"));
  // hardcode for now
  availableDiscordChannels = [
    "#job-offers - <#979685559654027295>",
    "#games - <#671455728027959322>",
    "#cheat-engine - <#979712419481939999>",
    "#ai-general-talk - <#989926403296337930>",
    "#ai-news-and-links - <#1086196398749401149>",
    "#welcome-log - <#979709375428067328>",
    "#reversing-private - <#825060891510308887>",
    "#general-chat-eng - <#605806276986929156>",
    "#off-topic - <#584036601101811717>",
    "#useful-tools - <#711183558823116822>",
    "#c-sharp-dotnet - <#1019117646337277962>",
    "#ida - <#979712336153681970>",
    "#unity - <#1016016146694152252>",
    "#gta-2 - <#589057145505447947>",
    "#general-chat-rus - <#605806197362130944>",
    "#rules - <#979685480763363398>",
    "#3d-print-and-craft - <#749224717470138428>",
    "#gta-4 - <#1015386490836107455>",
    "#blender - <#642781641886007337>",
    "#image-generation - <#1086196670053761064>",
    "#ai-farcry3 - <#1087396339169640518>",
    "#information - <#979716935149318224>",
    "#ghidra - <#586606271810109441>",
    "#unreal-engine - <#1016016179560726638>",
  ];
});

async function getUserLastMessage(
  msg: Message,
  count = 10,
  maxTime = 1000 * 60 * 5
): Promise<{ createdTimestamp: number; content: string }[]> {
  const userId = msg.author.id;
  const channelId = msg.channel.id;

  const channel = await client.channels.fetch(channelId);
  if (!(channel instanceof TextChannel)) {
    console.log("This is not a text channel");
    return [];
  }

  const messages = await channel.messages.fetch({ limit: 50 });

  const userMessages = messages
    .filter((msg) => msg.author.id === userId)
    .filter((msg) => Date.now() - msg.createdTimestamp < maxTime)
    .first(count)
    .map(({ createdTimestamp, content }) => ({
      createdTimestamp,
      content,
    }));
  userMessages.reverse();
  return userMessages;
}

client.on(Events.MessageCreate, async (msg: Message) => {
  console.log("on messageCreate", msg.content, {
    author: msg.author.username,
    authorId: msg.author.id,
    channel: (msg.channel as TextChannel).name,
    time: new Date().toISOString(),
    attachments: msg.attachments,
    parentName: (msg.channel as TextChannel).parent?.name,
  });
  try {
    if (msg.author.bot) return;
    if (msg.content === "!hello") {
      await handleHello(msg);
    } else if (
      msg.content.startsWith("!gpt") ||
      msg.content.startsWith("!гпт")
    ) {
      if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name)) {
        await coderChatbotHandler(msg);
      } else {
        await handleGpt(msg);
      }
    } else if (
      msg.content.startsWith("!img") ||
      msg.content.startsWith("!image")
    ) {
      await handleImageGeneration(msg);
    } else if (isBotMentioned(msg)) {
      if (msg.author.id === "1085479521240743946") return;
      if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name)) {
        await coderChatbotHandler(msg);
      } else {
        await handleMessageWithEmiliaMention(msg);
      }
    } else if (msg.content.startsWith("!prompt")) {
      msg.reply(`Current prompt:\n\n${currentTestPrompt}`);
    } else if (msg.content.startsWith("!setprompt")) {
      const prompt = msg.content.replace("!setprompt", "").trim();
      setCurrentTestPrompt(prompt);
      await msg.reply(`New prompt: "${currentTestPrompt}"`);
    } else if (fixGrammarUsers.includes(msg.author.id)) {
      await handleGrammarFix2(msg, getUserLastMessage, gpt);
    }
  } catch (e: unknown) {
    console.error(e);
    msg.reply("Error: " + (e as Error).message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

function isBotMentioned(msg: Message): boolean {
  const includesArray = ["ботик", "ботяра", "ботан", "botik", "botan"];
  return (
    msg?.mentions?.repliedUser?.id === "1085479521240743946" ||
    includesArray.some((include) => msg.content.toLowerCase().includes(include))
  );
}

async function handleHello(msg: Message) {
  msg.reply("Hello, I am your bot!");
}

async function handleGpt(msg: Message) {
  msg.react("👀");
  const options: GptOptions = {};
  if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name))
    options.putSystemMessageFirst = true;
  const response = await gpt(
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

async function handleMessageWithEmiliaMention(msg: Message) {
  msg.react("👀");
  const gptConversation = await fetchMessageHistory(msg);
  const options: GptOptions = {};
  if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name))
    options.putSystemMessageFirst = true;
  const response = await gpt(msg, gptConversation, options);
  return sendSplitResponse(msg, response);
  // return generateVoiceResponse(msg, response);
}

function calculateTokens(text: string): number {
  const tokens = encode(text);
  return tokens.length;
}

function limitTokens(text: string, maxTokens: number): string {
  const tokens = encode(text);
  const limitedTokens = tokens.slice(tokens.length - maxTokens, tokens.length);
  return decode(limitedTokens);
}

export async function fetchMessageHistory(msg: Message) {
  let refMsg = msg.reference?.messageId;
  const gptConversation = [];

  let content = msg.content.replace("!gpt", "").replace("!гпт", "");
  let tokens =
    calculateTokens(content) + calculateTokens(buildSystemMessage(msg));
  const MAX_TOKENS = 14000;
  if (tokens > MAX_TOKENS) {
    await msg.reply(
      `ERROR: Message is too long (${tokens} tokens), please shorten it`
    );
    throw new Error("ERROR: Message is too long, please shorten it");
  }

  for (let i = 0; i < 20; i++) {
    if (refMsg) {
      const refMsgObj = await loadReferenceMessage(msg, refMsg);
      if (refMsgObj) {
        const regex = /^\[([^\n]*)\]/;
        let cleanedMessage = refMsgObj.content.replace(regex, "").trim();
        let msgTokens = calculateTokens(cleanedMessage);
        if (msgTokens + tokens > MAX_TOKENS) {
          cleanedMessage = limitTokens(cleanedMessage, MAX_TOKENS - tokens);
          tokens = MAX_TOKENS;
        } else {
          tokens += msgTokens;
        }
        gptConversation.unshift({
          role: refMsgObj.author.bot ? "assistant" : "user",
          content: cleanedMessage,
        });
        refMsg = refMsgObj.reference?.messageId;
        if (tokens >= MAX_TOKENS) break;
      }
    }
  }

  if (authorsToAllowGPT4.includes(msg.author.id) && msg.attachments.size > 0) {
    // image API is not enabled yet :(
    // const attachment = msg.attachments.first();
    // const response = await axios.get(attachment.url, {
    //   responseType: "arraybuffer",
    // });
    // const buffer = Buffer.from(response.data, "binary");
    // content = [content, { image: "aaa" }];
  }

  // Push the user's message to gptConversation
  gptConversation.push({
    role: "user",
    content,
  });

  console.log("gptConversation tokens", tokens);

  return gptConversation;
}

async function sendSplitResponse(msg: Message, text: string) {
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

function getGPTModelName(msg: Message): string {
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

async function gpt(
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
  console.log("gpt", { messages });
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
