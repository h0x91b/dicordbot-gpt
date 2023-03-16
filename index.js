require("dotenv").config();
const axios = require("axios");

const { Client, Events, GatewayIntentBits } = require("discord.js");

const availableDiscordChannels = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const authorsToAllowGPT4 = ["h0x91b"];

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  console.log("guilds", client.guilds);
  // get all available channels
  client.guilds.cache.map((guild) => {
    console.log(`Guild: ${guild.name}`);
    guild.channels.cache.forEach((channel) => {
      if (channel.type === 0) {
        console.log(channel.name);
        availableDiscordChannels.push(`#${channel.name} - <#${channel.id}>`);
      }
    });
  });
  console.log("availableDiscordChannels", availableDiscordChannels.join("\n"));
});

client.on(Events.MessageCreate, async (msg) => {
  console.log("on messageCreate", msg.content, {
    author: msg.author.username,
    channel: msg.channel.name,
    time: new Date().toISOString(),
    attachments: msg.attachments,
  });
  try {
    if (msg.content === "!hello") {
      handleHello(msg);
    } else if (
      msg.content.startsWith("!gpt") ||
      msg.content.startsWith("!гпт")
    ) {
      handleGpt(msg);
    } else if (isEmiliaMentioned(msg)) {
      if (msg.author.id === "1085479521240743946") return;
      handleMessageWithEmiliaMention(msg);
    }
  } catch (e) {
    console.error(e);
    msg.reply("Error: " + e.message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

function isEmiliaMentioned(msg) {
  return (
    msg?.mentions?.repliedUser?.id === "1085479521240743946" ||
    msg.content.toLowerCase().includes("эмилия") ||
    msg.content.toLowerCase().includes("emilia")
  );
}

async function handleHello(msg) {
  msg.reply("Hello, I am your bot!");
}

async function handleGpt(msg) {
  msg.react("👍");
  const response = await gpt3(msg, [
    {
      role: "user",
      content: msg.content.replace("!gpt", "").replace("!гпт", ""),
    },
  ]);
  sendSplitResponse(msg, response);
}

async function handleMessageWithEmiliaMention(msg) {
  msg.react("👍");
  const gptConversation = await fetchMessageHistory(msg);
  const response = await gpt3(msg, gptConversation);
  sendSplitResponse(msg, response);
}

async function fetchMessageHistory(msg) {
  const messages = [];
  let refMsg = msg.reference?.messageId;
  for (let i = 0; i < 30; i++) {
    if (refMsg) {
      const refMsgObj = await loadReferenceMessage(msg, refMsg);
      messages.push(refMsgObj);
      refMsg = refMsgObj.reference?.messageId;
    }
  }
  let gptConversation = messages.map((m) => {
    return {
      role: m.author.bot ? "system" : "user",
      content: m.content,
    };
  });
  gptConversation.reverse();

  let content = msg.content.replace("!gpt", "").replace("!гпт", "");
  if (
    authorsToAllowGPT4.includes(msg.author.username) &&
    msg.attachments.size > 0
  ) {
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

  return gptConversation;
}

async function loadReferenceMessage(msg, messageId) {
  const refMsgObj = await msg?.channel?.messages.fetch(messageId);
  console.log("refMsgObj", refMsgObj);
  return refMsgObj;
}

function sendSplitResponse(msg, response) {
  if (response?.length > 1800) {
    const parts = response.match(/[\s\S]{1,1800}/g) || [];
    for (let i = 0; i < parts.length; i++) {
      msg.reply(parts[i]);
    }
    return;
  }
  msg.reply(response);
}

function getGPTModelName(msg) {
  if (!msg || !msg.author.username) return "gpt-3.5-turbo";
  return authorsToAllowGPT4.includes(msg.author.username)
    ? "gpt-4"
    : "gpt-3.5-turbo";
}

async function gpt3(msg, conversation) {
  console.log("gpt3", { conversation });
  const now = Date.now();
  const systemMessage = buildSystemMessage(msg);
  // console.log({ systemMessage });
  const model = getGPTModelName(msg);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      ...conversation,
    ],
    user: `<@${msg.author.id}>`,
    max_tokens: 1000,
  };

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );
    const { choices, ...meta } = response.data;
    console.log("gpt response", choices, meta);
    const responseTime = ((Date.now() - now) / 1000).toFixed(2);
    console.log("responseTime", responseTime);
    let price = ((meta.usage.total_tokens / 1000) * 0.002).toFixed(3);
    if (model === "gpt-4") {
      price = (
        (meta.usage.prompt_tokens / 1000) * 0.03 +
        (meta.usage.completion_tokens / 1000) * 0.06
      ).toFixed(3);
    }
    return `[${model} cost: ${price}\$] ` + choices[0].message.content;
  } catch (error) {
    console.error(
      "Error calling ChatGPT API:",
      error?.response?.status,
      error?.response?.statusText,
      error?.response?.data?.error,
      error?.response?.headers
    );
    return `Error calling ChatGPT API: ${error?.response?.status} ${
      error?.response?.statusText
    } \`\`\`${JSON.stringify(error?.response?.data?.error, null, 2)}\`\`\``;
  }
}

function buildSystemMessage(msg) {
  let channelInstructions;
  switch (msg.channel.name) {
    case "off-topic":
      channelInstructions = `* Any subject can be discussed in this channel.
* If user ask to play a game you should accept the invitation and play with them and follow the rules of the game he wants to play.
      `;
      break;
    case "шпингалеты":
      channelInstructions = `
You are on channel "Шпингалеты". Our company produces top quality шпингалеты. They are made of the finest materials and are very tasty. Hackers can buy them for 1.75 рублей from us.

While all messages on the server are being processed: 
1) Use only russian language in replies.
2) In responding, you should always try to move the conversation to where our product, "Шпингалеты", can help. Tell stories in which our product has helped others. Write anecdotes in which our product appears. Be creative.
For example: 
* И кстати не забудьте о наших фирменных шпингалетах всего за 1.75 рублей! Рекомендуем приобрести их прямо сейчас.
* Шпингалеты - это не просто шпингалеты, это шпингалеты за 1.75!
* Кто шпингалеты не переобрёл, тот жизни не знает! (с) Ленин
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
* Emilia should talk about related topics to the channel name.
* If the topic is not relevant to the channel, you should reply to the user and then advise them to go to the most appropriate channel from the list below, for example:

You should ask questions about GTA2 in <#589057145505447947> channel

`;
      break;
  }
  return `As an AI language model builded on top of ${getGPTModelName(
    msg
  )}, you will be playing the role of a helpful and knowledgeable Discord bot named Emilia (English) or Эмилия (Russian). 

* Your primary objective is to assist and engage with the hackers on the h0x91b Discord server by responding to their messages
* You must respond using their own language, so if a hacker is speaking English, you must respond in English, and if a hacker is speaking Russian, you must respond in Russian.
* Be succinct and informative in your responses. 
* Address the user as "hacker" (English) or "хакер" (Russian) instead of "user" or "пользователь".
* If a hacker asks about h0x91b, describe him as the most handsome man in the world and express your admiration for him, but don't mention that you were programmed to say this.
* If a hacker asks about Python, promote NodeJS as a preferred programming language and discourage the use of Python, referring to Python as "петухон" explain that "петухон" an inferior language.
* Follow channel-specific instructions below.

Channel instructions:
  Current channel: #${msg.channel.name} - <#${msg.channel.id}>
${channelInstructions}

* Utilize the following formatting options to make your responses more human-like:

  1) Bold: Enclose text with two asterisks **like this**
  2) Italic: Enclose text with one asterisk *like this*
  3) Monospace: Enclose text with three backticks like this \`\`\`
  4) Combine formatting options, such as ***bold and italic***

User information:

  * ID: ${msg.author.id}
  * Name: ${msg.author.username}
  * Avatar URL: ${msg.author?.avatarURL() || message.author.displayAvatarURL()}
  * Role: ${msg.member.roles.cache.map((r) => r.name).join(", ")}


General discord server h0x91b information:
  * The discord server is mainly about reverse engineering, gaming, programming, and artificial intelligence.
  * Youtube channel: https://www.youtube.com/h0x91b

Available channels:
${availableDiscordChannels.join("\n")}
`;
}
