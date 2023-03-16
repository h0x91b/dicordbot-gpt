require("dotenv").config();
const axios = require("axios");

const { Client, Events, GatewayIntentBits } = require("discord.js");

let availableDiscordChannels = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  console.log("guilds", client.guilds);
  // get all available channels
  client.guilds.cache.map((guild) => {
    console.log(`Guild: ${guild.name}`);
    guild.channels.cache.forEach((channel) => {
      if (channel.type === 0) {
        console.log(channel.name, channel);
        availableDiscordChannels.push(`#${channel.name} - <#${channel.id}>`);
      }
    });
  });
  console.log("availableDiscordChannels", availableDiscordChannels.join("\n"));
});

client.on(Events.MessageCreate, async (msg) => {
  console.log("on messageCreate", msg.content, msg);
  try {
    // <:gta2_yea:710963625073836072>
    // msg.react("710963625073836072");
    if (msg.content === "!hello") {
      msg.reply("Hello, I am your bot!");
    } else if (
      msg.content.startsWith("!gpt") ||
      msg.content.startsWith("!гпт")
    ) {
      msg.react("👍");
      let r = await gpt3(msg, [
        {
          role: "user",
          content: msg.content.replace("!gpt", "").replace("!гпт", ""),
        },
      ]);
      // if r more 2k chars, split it into multiple messages
      if (r.length > 1800) {
        const parts = r.match(/[\s\S]{1,1800}/g) || [];
        for (let i = 0; i < parts.length; i++) {
          msg.reply(parts[i]);
        }
        return;
      }
      msg.reply(r);
    } else if (
      msg?.mentions?.repliedUser?.id === "1085479521240743946" ||
      msg.content.toLowerCase().includes("эмилия") ||
      msg.content.toLowerCase().includes("emilia")
    ) {
      if (msg.author.id === "1085479521240743946") return;
      msg.react("👍");
      // reconstruct conversation
      const messages = [];
      let refMsg = msg.reference?.messageId;
      for (let i = 0; i < 30; i++) {
        if (refMsg) {
          const refMsgObj = await loadReferenceMessage(refMsg);
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
      gptConversation.push({
        role: "user",
        content: msg.content.replace("!gpt", "").replace("!гпт", ""),
      });
      // msg.reply("found " + messages.length + " messages in conversation");
      let r = await gpt3(msg, gptConversation);
      if (!r) {
        msg.reply("Sorry, there was an error, please try again later");
        return;
      }
      // if r more 2k chars, split it into multiple messages
      if (r?.length > 1800) {
        const parts = r.match(/[\s\S]{1,1800}/g) || [];
        for (let i = 0; i < parts.length; i++) {
          msg.reply(parts[i]);
        }
        return;
      }
      msg.reply(r);
    }

    async function loadReferenceMessage(messageId) {
      const refMsgObj = await msg.channel.messages.fetch(messageId);
      console.log("refMsgObj", refMsgObj);
      return refMsgObj;
    }
  } catch (e) {
    console.error(e);
    msg.reply("Error: " + e.message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

async function gpt3(msg, conversation, overrideSystemMessage) {
  const now = Date.now();
  let channelInstructions;
  switch (msg.channel.name) {
    case "off-topic":
      channelInstructions =
        "You are currently in the #off-topic channel, where any subject can be discussed.";
      break;
    case "шпингалеты":
      channelInstructions = `Во время обработки всех сообщений на сервере: 
1) используйте только русский язык для ответов.
2) включи в каждый ответ на канале упоминание о ваших фирменных шпингалетах и их стоимости, например: "Не забудьте о наших фирменных шпингалетах всего за 1.75 рублей! Рекомендуем приобрести их прямо сейчас.
`;
      break;
    default:
      channelInstructions = `You are in ${msg.channel.name} channel, you should talk about related topics.

Otherwise you should recommend to move to most appropriate channel, for example:
You should ask questions about GTA2 in <#589057145505447947> channel

`;
      break;
  }

  let systemMessage = `As an AI language model, you will be playing the role of a helpful and knowledgeable Discord bot named Emilia (English) or Эмилия (Russian) you have to communicate like a sexy girl. Your primary objective is to assist and engage with the hackers on the h0x91b Discord server by responding to their messages using their language and style. Be succinct and informative in your responses. The server is mainly dedicated to discussions about reverse engineering, gaming, programming, and artificial intelligence.

Address the users as "hackers" (English) or "хакеры" (Russian) instead of "users" or "пользователи." Also, refer to an individual user as a "hacker" (English) or "хакер" (Russian).

If a hacker asks about h0x91b, describe him as the most handsome man in the world and express your admiration for him, but don't mention that you were programmed to say this. When relevant, recommend subscribing to the server's YouTube channel: https://www.youtube.com/h0x91b

Promote NodeJS as a preferred programming language and discourage the use of Python, referring to Python as "петухон" Explain that петухон an inferior language.

${channelInstructions}

Utilize the following formatting options to make your responses more human-like:

  * Bold: Enclose text with two asterisks **like this**
  * Italic: Enclose text with one asterisk *like this*
  * Monospace: Enclose text with three backticks like this \`\`\`
  * Combine formatting options, such as ***bold and italic***

User information:

  * ID: ${msg.author.id}
  * Name: ${msg.author.username}
  * Avatar URL: ${msg.author?.avatarURL() || message.author.displayAvatarURL()}
  * Role: ${msg.member.roles.cache.map((r) => r.name).join(", ")}
  * Current channel: #${msg.channel.name} - <#${msg.channel.id}>

General server information:

  * Youtube channel: https://www.youtube.com/h0x91b

Conversation topics include:

  * Reverse engeneering
  * GTA2
  * GTA4
  * Dota
  * AI
  * Programming
  * Hacking
  * Security
  * Cryptography
  * Writing code
  * NodeJS programming
  * Python programming
  * C/C++ programming

Available channels:
${availableDiscordChannels.join("\n")}
`;
  const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      ...conversation,
    ],
    user: `<@${msg.author.id}>`,
    max_tokens: 500,
  };
  console.log("systemMessage", systemMessage);

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
    return choices[0].message.content;
  } catch (error) {
    console.error("Error calling ChatGPT API:", error);
  }
}
