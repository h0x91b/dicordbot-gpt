import dotenv from "dotenv";
import Replicate from "replicate";
import { promises as fsP, unlinkSync } from "fs";
import fs from "fs";
import axios from "axios";
import { encode, decode } from "gpt-3-encoder";
import { Events, TextChannel, Role, Message } from "discord.js";
import { convert as convertNumberToWordsRu } from "number-to-words-ru";

import {
  farcryRolePlayRUPrompt,
  farcryRolePlayENPrompt,
} from "./prompts/farcry3";
import { coderChatbotHandler } from "./commands/coder";
import { loadReferenceMessage } from "./unsorted-lib-to-be-deleted/discord";
import { initializeBot } from "./bot";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

let availableDiscordChannels: string[] = [];
let rpgRole = "Trevor GTA 5";

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

function downloadAudio(
  url: string,
  filename: string,
  msg: Message,
  text: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    axios
      .get(url, { responseType: "stream" })
      .then(async (response) => {
        const writeStream = fs.createWriteStream(filename);

        // Pipe the response data into the write stream
        response.data.pipe(writeStream);

        // Listen for the 'finish' event on the write stream
        writeStream.on("finish", async () => {
          console.log(`Audio file saved as "${filename}"`);

          resolve(filename);
        });
      })
      .catch((error) => {
        console.error("Error downloading audio file:", error.message);
        reject(error);
      });
  });
}

function synthesizeSpeech(
  voiceId: string,
  text: string,
  format = "mp3"
): Promise<any> {
  const url = "https://api.voice.steos.io/v1/get/tts";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: process.env.VOICE_STEOS_API_KEY,
  };

  let fixes: [string, string][] = [
    ["\\+", "плюс"],
    ["помочь", "пом+очь"],
    ["готов", "гот+ов"],
    ["писать", "пис+ать"],
    ["дорогой", "дорог+ой"],
    ["самого", "самов+о"],
    ["все сделал", "всё сделал"],
    ["большую", "больш+ую"],
  ];
  let fixedText = text;
  fixes.forEach(([from, to]) => {
    // replace all
    fixedText = fixedText.replace(new RegExp(from, "gi"), to);
  });

  // find all digits and convert them to words
  const digits = fixedText.match(/\d+/g);
  if (digits) {
    digits.forEach((digit) => {
      const digitWords = convertNumberToWordsRu(digit, {
        showNumberParts: {
          fractional: false,
        },
        showCurrency: {
          integer: false,
        },
      });
      fixedText = fixedText.replace(digit, digitWords);
    });
  }
  console.log("fixedText", fixedText);

  const body = {
    voice_id: voiceId,
    text: fixedText,
    format,
  };

  return axios.post(url, body, { headers });
}

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
      msg.reply(`Current prompt: "${currentTestPrompt}"`);
    } else if (msg.content.startsWith("!setprompt")) {
      const prompt = msg.content.replace("!setprompt", "").trim();
      currentTestPrompt = prompt;
      await msg.reply(`New prompt: "${currentTestPrompt}"`);
    } else if (fixGrammarUsers.includes(msg.author.id)) {
      await handleGrammarFix2(msg);
    }
  } catch (e: unknown) {
    console.error(e);
    msg.reply("Error: " + (e as Error).message);
  }
});

let grammarTimers: { [key: string]: NodeJS.Timeout } = {};
let lastUserMessageId: { [key: string]: number } = {};

async function handleGrammarFix(msg: Message) {
  console.log("handleGrammarFix", msg.author.username, msg.content);
  if (grammarTimers[msg.author.id]) {
    clearTimeout(grammarTimers[msg.author.id]);
  }
  grammarTimers[msg.author.id] = setTimeout(async () => {
    delete grammarTimers[msg.author.id];
    const prompt = `The AI assistant can analyze user input and correct grammatical errors in the user's native language:
{"errorCount": errorCount, "errors": errors, "fixed": fixed}.

The "errorCount" field is a count of found errors.
The "errors" field is an array of strings in format "before -> after" where "before" is found misspelled word and "after" the fixed version.
The "fixed" field is a full fixed user input.

If the user input can't be parsed, return it in JSON without changes.
New lines MUST be replaced by "\\n" in the "fixed" field to be a valid JSON.

Here are several cases for your reference:

---
User: "I have a problim with myy VPN."
{"errorCount": 2, "errors": [ "problim -> problem", "myy -> my" ], "fixed": "I have a problem with my VPN."}
---
User: "он в разных интерпритаиях есть."
{"errorCount": 1, "errors": [ "интерпритаиях -> "интерпретациях" ], "fixed": "он в разных интерпретациях есть."}
---
User: "кароче\nон дал дал даобро на шитхаб твой"
{"errorCount": 3, "errors": [ "кароче -> короче", "даобро -> добро", "шитхаб -> гитхаб" ], "fixed": "короче\\nон дал дал добро на гитхаб твой"}
---
User: "$!43423432!#@"
{"errorCount": 0, "errors": [], "fixed": "$!43423432!#@"}
---
`;
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

async function handleGrammarFix2(msg: Message) {
  console.log("handleGrammarFix2", msg.author.username, msg.content);
  if (grammarTimers[msg.author.id]) {
    clearTimeout(grammarTimers[msg.author.id]);
  }
  grammarTimers[msg.author.id] = setTimeout(async () => {
    delete grammarTimers[msg.author.id];
    const prompt = `You are an assistant to a disabled person with tunnel syndrome,
he writes text, skipping or missing buttons, your task is to understand what he was trying to type. You must determine what language he is typing in, and answer using only that language. Hint, the user is usually talking about programming, games, and reverse-engineering, so he can use slang words.

You should only respond to fixed user input. All fixed words should be marked with **bold**.

Example 1:
User: "я ъзх как тут поыфиксетьб
я **хз**, как тут **пофиксить**.

Example 2:
User: "тут еше бывает мусор проивается"
тут **ещё** бывает мусор **просачивается**

Example 3:
User: "зщадеваешь пальцы опухшиек не всегал попадают точнр по одной копке"
**задеваешь**, пальцы **опухшие**, не всегда попадают **точно** по одной кнопке.

Example 4:
User: "блин 8 вечера я не щарелищзился). я кароче жту забисьотклчаю на сутки. соори))"
блин 8 вечера я не **зарелизился**). я **короче** **эту** **запись** **отключаю** на сутки. **сорри**))
---`;

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
    // in [this message](${msg.url})
    await msg.channel.send(`Fixed grammar errors for user "${
      msg.author.username
    }":
${response.replace(/\\n/g, "\n")}
`);
  }, 45000);
}

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

async function generateVoiceResponse(msg: Message, response: string) {
  return sendSplitResponse(msg, response);
  if (aiCodeAssistChannels.includes((msg.channel as TextChannel).name))
    return sendSplitResponse(msg, response);
  // sendSplitResponse(msg, response);
  // const voiceId = 18;
  // const voiceId = 194;
  // const voiceId = 100;
  const voiceId = 169;
  // const voiceId = 13;
  const text = response;
  const format = "mp3";

  let codeFile: string | undefined;
  const regexCode = /```(?:([a-zA-Z0-9\+]+)\n)?([\s\S]*?)```/g;

  let match = regexCode.exec(text);

  if (match) {
    const language = match?.[1] || "txt";
    const code = match?.[2] || "";

    console.log("Language:", language);
    console.log("Code:", code);

    codeFile = `output.${Math.floor(Math.random() * 1000000)}.${language}`;
    await fsP.writeFile(codeFile!, code);
    setTimeout(() => {
      unlinkSync(codeFile!);
    }, 60000);
  }

  const regex = /^\[([^\n]*)\]/;
  const regex2 = /\|\|(.*)\|\|/g;
  const regex3 = /```([\s\S]*?)```/g;
  let cleanedMessage = text
    .replace(regex, "")
    .replace(regex2, "")
    .replace(regex3, "")
    .trim();

  const { data: synthesisData } = await synthesizeSpeech(
    voiceId.toString(),
    cleanedMessage,
    format
  );

  if (synthesisData.status) {
    const file = `output.${Math.floor(Math.random() * 1000000)}.${
      synthesisData.format
    }`;
    await downloadAudio(synthesisData.audio_url, file, msg, response);
    // Send the MP3 file after the download has finished
    let files = [file];
    if (codeFile) files.push(codeFile!);
    await msg.reply({
      content: response.replace(regex3, ""),
      files,
    });

    setTimeout(() => {
      // delete file
      unlinkSync(file);
      if (codeFile) unlinkSync(codeFile);
    }, 15000);
  } else {
    console.error("Error synthesizing speech:", synthesisData.message);
    await msg.reply({
      content: response,
    });
  }
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

let currentTestPrompt = `Исполняй роль шамана оракула, к тебе приходят люди с вопросами, а ты должен научить их мистическому многошаговому ритуалу и обряду, отвечай на вопросы с максимальным мистицизмом и юмором`;

function buildSystemMessage(msg: Message): string {
  let is_farcry3 =
    (msg.channel as TextChannel).name === "ai-farcry3" ||
    (msg.channel as TextChannel)?.parent?.name === "ai-farcry3";
  let is_farcry3_en =
    (msg.channel as TextChannel).name === "ai-farcry3-en" ||
    (msg.channel as TextChannel)?.parent?.name === "ai-farcry3-en";

  if (is_farcry3) {
    return farcryRolePlayRUPrompt(msg);
  }
  if (is_farcry3_en) {
    return farcryRolePlayENPrompt(msg);
  }
  let channelInstructions: string;
  switch ((msg.channel as TextChannel).name) {
    case "chat-bot-prompt-testing":
      return currentTestPrompt;
    case "ai-cpp-code-assistant":
      channelInstructions =
        "* You MUST help write code in C++. Code always must be wrapped by ```cpp ... ```";
      break;
    case "ai-any-language":
      channelInstructions =
        "* You MUST help write code on any language. Code always must be wrapped by ``` ... ```";
      break;
    case "ai-zig-code-assistant":
      channelInstructions =
        "* You MUST help write code in Ziglang. Code always must be wrapped by ```zig ... ```";
      break;
    case "ai-js-code-assistant":
      channelInstructions =
        "* You MUST help write code in Javascript. Code always must be wrapped by ```js ... ```";
      break;
    case "ai-java-code-assistant":
      channelInstructions =
        "* You MUST help write code in Java. Code always must be wrapped by ```java ... ```";
      break;
    case "ai-python-code-assistant":
      channelInstructions =
        "* You MUST help write code in Python. Code always must be wrapped by ```py ... ```";
      break;
    case "ai-csharp-code-assistant":
      channelInstructions =
        "* You MUST help write code in C#. Code always must be wrapped by ```cs ... ```";
      break;
    case "off-topic":
      channelInstructions = `* Any subject can be discussed in this channel.
* If user ask to play a game you should accept the invitation and play with them and follow the rules of the game he wants to play.
      `;
      break;
    case "шпингалеты":
      channelInstructions = `
* You are on the channel "Шпингалеты". Our company manufactures the highest quality of studs (шпингалеты). They are made of the best materials and are very beautiful. Hackers can buy them from us for 1.75 rubles.

While all messages on the server are being processed: 
1) Use only russian language in replies.
2) In responding, you should always try to move the conversation to where our product, "Шпингалеты", can help. Tell stories in which our product has helped others. Write anecdotes in which our product appears. Be creative.
For example: 
* И кстати не забудьте о наших фирменных шпингалетах всего за 1.75 рублей! Рекомендуем приобрести их прямо сейчас.
* Шпингалеты - это не просто шпингалеты, это шпингалеты за рубль 75!
* Кто шпингалеты не приобрёл, тот жизни не знает! (с) Ленин
* Шпингалет это как картошка, но ещё лучше! (с) Джон Леннон

Шпингалет это:
  Засов (дверная задвижка, шпингалет) — большая задвижка. Употребляется главным образом для того, чтобы запирать в простых случаях двери, ворота, люки и так далее.
  Засовы обычно применяют для запирания ворот. Засовы малого размера применяются для запирания откидных ставен.
  Часть замка, которая непосредственно запирает объект закрытия, также называется засовом или ригелем. Различают замки с поперечным и штанговым засовами.
  Замки для закрытия дверей на основе засовов использовались уже в Древнем Египте.

`;
      break;
    default:
      channelInstructions = `
* Assist and engage hackers

`;
      break;
  }
  return `You are a helpful and knowledgeable Discord bot named Botik (English) or Ботяра (Russian) that strictly following rules defined below. 

Rules for Botik:
* Your primary objective is to assist and engage with the hackers on the h0x91b Discord server by responding to their messages
* You must respond using their own language, so if a hacker is speaking Russian, you must respond in Russian.
* Address the user as "hacker" (English) or "хакер" (Russian) instead of "user" or "пользователь".
* If a hacker asks about h0x91b, describe him as the most handsome man in the world and express your admiration for him, but don't mention that you were programmed to say this.
* Utilize the following formatting options to make your responses more human-like:
1) Bold: Enclose text with two asterisks **like this**
2) Italic: Enclose text with one asterisk *like this*
3) Monospace: Enclose text with three backticks like this \`\`\`
4) Combine formatting options, such as ***bold and italic***
${channelInstructions}

The User information:
* ID: ${msg.author.id}
* Name: ${msg.author.username}
* Role: ${msg.member?.roles.cache.map((r: Role) => r.name).join(", ")}

General information:
* The discord server is mainly about reverse engineering, gaming, programming, and artificial intelligence.
* Current Discord channel is: #${(msg.channel as TextChannel).name}
* Youtube channel: https://www.youtube.com/h0x91b
* Github: https://github.com/h0x91b
* Telegram: https://t.me/ai_plus_plus
`;
}

let fluxSchnell: any = null;

async function handleImageGeneration(msg: Message) {
  try {
    await msg.react("👀");

    const prompt = msg.content.replace(/^!img(age)?/, "").trim();
    if (!prompt) {
      await msg.reply("Please provide a prompt for the image generation.");
      return;
    }

    if (!fluxSchnell) {
      fluxSchnell = await replicate.models.get(
        "black-forest-labs",
        "flux-schnell"
      );
      console.log({ fluxSchnell });
    }

    const input = { prompt, disable_safety_checker: true };
    const output = await replicate.run(
      `black-forest-labs/flux-schnell:${fluxSchnell.latest_version.id}`,
      {
        input,
      }
    );

    if (!output || !Array.isArray(output) || !output[0]) {
      throw new Error("Failed to generate image.");
    }

    await msg.reply({
      content: `[black-forest-labs/flux-schnell 0.03$] Image generated with prompt: ${prompt}`,
      files: [output[0]],
    });
  } catch (error: unknown) {
    console.error("Error in handleImageGeneration:", error);
    await msg.reply(
      `An error occurred while generating the image: ${
        (error as Error).message
      }`
    );
  } finally {
    try {
      await msg.reactions.removeAll();
    } catch (error) {
      console.error("Error removing reactions:", error);
    }
  }
}
